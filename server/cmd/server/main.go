package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/gin-gonic/gin"

	"comic-record/server/internal/config"
	"comic-record/server/internal/handler"
	"comic-record/server/internal/middleware"
	"comic-record/server/internal/store"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		logger.Error("config_load_failed", slog.Any("err", err))
		os.Exit(1)
	}
	logger.Info("config_loaded",
		slog.String("port", cfg.Port),
		slog.Any("allowed_origins", cfg.AllowedOrigins),
		slog.String("table", cfg.TableName),
		slog.String("region", cfg.AWSRegion),
		slog.String("model_id", cfg.BedrockModelID),
	)

	// AWS SDK 走預設 credential chain(env / shared file / IRSA)
	awsCfg, err := awsconfig.LoadDefaultConfig(
		context.Background(),
		awsconfig.WithRegion(cfg.AWSRegion),
	)
	if err != nil {
		logger.Error("aws_config_failed", slog.Any("err", err))
		os.Exit(1)
	}

	ddbClient := dynamodb.NewFromConfig(awsCfg)
	mangaStore := store.NewDynamoDBStore(ddbClient, cfg.TableName)
	bedrockClient := bedrockruntime.NewFromConfig(awsCfg)

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.Logger(logger))
	r.Use(middleware.CORS(cfg.AllowedOrigins))

	// liveness:只看 process 活著(沒掛掉、沒死鎖)
	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// readiness:依賴的 AWS DynamoDB 是否可用。連不到回 503,K8s 不再送流量。
	r.GET("/readyz", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		if err := mangaStore.Ready(ctx); err != nil {
			logger.Warn("readyz_failed", slog.Any("err", err))
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "not_ready"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	})

	r.POST("/auth/login", handler.PostLogin(cfg.AppPassword, cfg.JWTSecret))

	authed := r.Group("/")
	authed.Use(middleware.RequireAuth(cfg.JWTSecret))
	{
		authed.GET("/mangas", handler.ListMangas(mangaStore))
		authed.POST("/mangas", handler.CreateManga(mangaStore))
		authed.PATCH("/mangas/:id", handler.UpdateManga(mangaStore))
		authed.DELETE("/mangas/:id", handler.DeleteManga(mangaStore))
		authed.POST("/recommendations", handler.PostRecommend(bedrockClient, cfg.BedrockModelID))
	}

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		logger.Info("server_starting", slog.String("addr", srv.Addr))
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server_failed", slog.Any("err", err))
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	// K8s 會把這個 pod 從 Service endpoint 拿掉,但 iptables / EndpointSlice
	// 在所有節點 propagate 完成前,流量還會送過來。這段期間繼續正常服務,
	// 等 K8s 通知都傳完了再 stop 接受新連線。本機開發跑(沒 KUBERNETES_*) 跳過。
	if os.Getenv("KUBERNETES_SERVICE_HOST") != "" {
		logger.Info("sigterm_grace_period_start")
		time.Sleep(5 * time.Second)
	}

	logger.Info("server_shutting_down")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("shutdown_failed", slog.Any("err", err))
	}
}
