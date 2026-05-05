import * as path from 'node:path'
import {
  CfnOutput,
  Duration,
  Stack,
  type StackProps,
} from 'aws-cdk-lib'
import * as apigw from 'aws-cdk-lib/aws-apigateway'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Architecture, type IFunction, Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction, type NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import type { Construct } from 'constructs'

interface ComicVibeStackProps extends StackProps {
  stage: 'dev' | 'prod'
}

export class ComicVibeStack extends Stack {
  constructor(scope: Construct, id: string, props: ComicVibeStackProps) {
    super(scope, id, props)

    const { stage } = props

    // CORS allowlist。需要前端能打到的 origin 都列在這。
    // 本機 dev 用 localhost:5173;部署到 GitHub Pages 用 https://<user>.github.io
    // 注意:GitHub Pages origin 不含子路徑(/comic-record/)
    const corsAllowedOrigins = [
      'http://localhost:5173',
      'https://bojun1117.github.io',
    ]

    // SSM parameter 名稱(值由 AWS CLI 手動建立,見 INFRA.md)
    const passwordParamName = `/comic-vibe/${stage}/app-password`
    const jwtSecretParamName = `/comic-vibe/${stage}/jwt-secret`

    // 取得 SSM parameter 物件,用來授權(只授權,不取值)
    const passwordParam = ssm.StringParameter.fromSecureStringParameterAttributes(
      this,
      'AppPasswordParam',
      { parameterName: passwordParamName },
    )
    const jwtSecretParam = ssm.StringParameter.fromSecureStringParameterAttributes(
      this,
      'JwtSecretParam',
      { parameterName: jwtSecretParamName },
    )

    // ─── DynamoDB ───────────────────────────────────────
    // Table 由 AWS 帳號既有,不由 CDK 建立或管理 lifecycle。
    // 之前 cdk destroy 把 stack 砍掉時 table 被保留(資料還在),為避免重建撞名,
    // 改用 fromTableName 引用。schema/PITR/removalPolicy 變更需手動或另起 stack。
    const table = dynamodb.Table.fromTableName(
      this,
      'MangasTable',
      `comic-vibe-mangas-${stage}`,
    )

    // ─── Lambda 共用設定 ────────────────────────────────
    const commonLambdaProps: Omit<NodejsFunctionProps, 'entry' | 'functionName'> = {
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(10),
      logRetention: RetentionDays.ONE_WEEK,
      environment: {
        TABLE_NAME: table.tableName,
        // 只傳 parameter 名稱(普通字串),Lambda 自己呼 SSM 拿值
        JWT_SECRET_PARAM: jwtSecretParamName,
        // CORS allowlist 給 Lambda 動態 echo Origin
        ALLOWED_ORIGINS: corsAllowedOrigins.join(','),
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node22',
        format: undefined,
        // @aws-sdk/* 都是 Lambda runtime 內建,bundle 不用包
        externalModules: ['@aws-sdk/*'],
      },
    }

    const lambdaDir = path.join(__dirname, '..', 'lambda')

    const loginFn = new NodejsFunction(this, 'LoginFn', {
      ...commonLambdaProps,
      entry: path.join(lambdaDir, 'login.ts'),
      functionName: `comic-vibe-login-${stage}`,
      environment: {
        ...commonLambdaProps.environment,
        APP_PASSWORD_PARAM: passwordParamName,
      },
    })

    const listFn = new NodejsFunction(this, 'ListMangasFn', {
      ...commonLambdaProps,
      entry: path.join(lambdaDir, 'list-mangas.ts'),
      functionName: `comic-vibe-list-mangas-${stage}`,
    })
    const createFn = new NodejsFunction(this, 'CreateMangaFn', {
      ...commonLambdaProps,
      entry: path.join(lambdaDir, 'create-manga.ts'),
      functionName: `comic-vibe-create-manga-${stage}`,
    })
    const updateFn = new NodejsFunction(this, 'UpdateMangaFn', {
      ...commonLambdaProps,
      entry: path.join(lambdaDir, 'update-manga.ts'),
      functionName: `comic-vibe-update-manga-${stage}`,
    })
    const deleteFn = new NodejsFunction(this, 'DeleteMangaFn', {
      ...commonLambdaProps,
      entry: path.join(lambdaDir, 'delete-manga.ts'),
      functionName: `comic-vibe-delete-manga-${stage}`,
    })

    // 推薦 Lambda 呼 Bedrock,timeout 拉長到 30s(LLM 反應有時較慢)
    const recommendFn = new NodejsFunction(this, 'RecommendFn', {
      ...commonLambdaProps,
      entry: path.join(lambdaDir, 'recommend.ts'),
      functionName: `comic-vibe-recommend-${stage}`,
      timeout: Duration.seconds(30),
    })

    // DynamoDB 權限
    table.grantReadData(listFn)
    table.grantReadWriteData(createFn)
    table.grantReadWriteData(updateFn)
    table.grantReadWriteData(deleteFn)

    // SSM 權限:每個需要 secret 的 Lambda 給對應 parameter 的讀取權
    const mangaFns: IFunction[] = [listFn, createFn, updateFn, deleteFn]
    for (const fn of mangaFns) {
      jwtSecretParam.grantRead(fn)
    }
    jwtSecretParam.grantRead(loginFn)
    jwtSecretParam.grantRead(recommendFn)
    passwordParam.grantRead(loginFn)

    // Bedrock 權限:只給 recommend Lambda,只允許 InvokeModel
    // Anthropic 模型強制走 cross-region inference profile,所以要同時放行:
    //   1. inference profile 本身(us.* 開頭,在主要呼叫的 region 帳號下)
    //   2. profile 會 routing 到的所有底層 foundation model(任何 us-* region)
    recommendFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/us.anthropic.claude-haiku-4-5-*`,
          `arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-*`,
        ],
      }),
    )

    // SecureString 解密用的 KMS 權限(預設用 AWS managed key,grantRead 已包含)
    // 但 fromSecureStringParameterAttributes 不帶 kms decrypt,要顯式加
    const kmsDecrypt = new iam.PolicyStatement({
      actions: ['kms:Decrypt'],
      // 預設 alias 是 alias/aws/ssm,實際 key ARN 由 AWS managed
      resources: ['*'],
      conditions: {
        StringEquals: {
          'kms:EncryptionContext:PARAMETER_ARN': [
            `arn:aws:ssm:${this.region}:${this.account}:parameter${passwordParamName}`,
            `arn:aws:ssm:${this.region}:${this.account}:parameter${jwtSecretParamName}`,
          ],
        },
      },
    })
    for (const fn of [...mangaFns, loginFn, recommendFn]) {
      fn.addToRolePolicy(kmsDecrypt)
    }

    // ─── API Gateway ────────────────────────────────────
    const api = new apigw.RestApi(this, 'ComicVibeApi', {
      restApiName: `comic-vibe-api-${stage}`,
      description: `Comic Vibe API (${stage})`,
      deployOptions: {
        stageName: stage,
        throttlingRateLimit: 50,
        throttlingBurstLimit: 100,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: corsAllowedOrigins,
        allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    })

    const auth = api.root.addResource('auth')
    const login = auth.addResource('login')
    login.addMethod('POST', new apigw.LambdaIntegration(loginFn))

    const mangas = api.root.addResource('mangas')
    mangas.addMethod('GET', new apigw.LambdaIntegration(listFn))
    mangas.addMethod('POST', new apigw.LambdaIntegration(createFn))

    const mangaById = mangas.addResource('{id}')
    mangaById.addMethod('PATCH', new apigw.LambdaIntegration(updateFn))
    mangaById.addMethod('DELETE', new apigw.LambdaIntegration(deleteFn))

    const recommendations = api.root.addResource('recommendations')
    recommendations.addMethod('POST', new apigw.LambdaIntegration(recommendFn))

    new CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway base URL',
    })
    new CfnOutput(this, 'TableName', {
      value: table.tableName,
      description: 'DynamoDB table name',
    })
  }
}
