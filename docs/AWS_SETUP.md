# AWS Setup — 階段 3 Part A

階段 3 的前置作業:開 AWS 帳號、設定 CLI、設好 billing alert,確保接下來部署不會被亂收錢。

預計時間:**30–60 分鐘**(主要卡在等帳號驗證 email / 信用卡驗證)。

---

## 為什麼這份很重要

AWS 預設沒有「花費上限自動停機」這種東西。如果你的 Lambda 寫錯陷入無限迴圈、或者 NAT Gateway 開著沒關,可能一個月被收 30–100 鎂。

所以**Step 4 的 billing alert 是 must-do**,不是可選的。

整個階段 3 / 4 / 5 合理花費應該是:**$0 ~ $1 / 月**(全部在 free tier 內)。任何一天超過 $1 就代表有東西不對。

---

## Step 1:開 AWS 帳號

1. 去 https://aws.amazon.com/
2. 右上角「Create an AWS Account」
3. 填:
   - email(這會變成你的 root 帳號 email,**用一個你長期會用的 email**,不要用工作信箱)
   - 帳號名稱(隨便,例如 `lin-personal`)
4. 選帳號類型:**Personal**(個人)
5. 填地址、電話
6. 信用卡驗證(必填,但你不會被亂收錢,只是身份驗證用)
7. 電話驗證(會打電話給你或寄簡訊驗證碼)
8. 選 Support plan:**Basic Support — Free**

> **重要:不要用 root 帳號做開發**。Step 3 會建一個 IAM User 做日常操作。

---

## Step 2:登入 root 帳號 → 啟用 MFA

剛開好的 root 帳號**一定要立刻啟用 MFA**,否則被盜用你的信用卡會被刷爆。

1. 登入 https://console.aws.amazon.com/
2. 右上角頭像 → Security credentials
3. 「Multi-factor authentication (MFA)」→ Assign MFA device
4. 選 Authenticator app(用手機的 Google Authenticator / Authy / 1Password 都可)
5. 掃 QR code,輸入兩次連續驗證碼確認

之後 root 登入都要輸入驗證碼。

---

## Step 3:建一個 IAM User 給日常開發用

Root 帳號權力太大,平常用一個有限權限的 IAM User。

1. AWS Console 搜尋「IAM」進入 IAM 服務
2. 左側 Users → 「Create user」
3. User name: `cdk-deploy`(隨便取,但建議寫得出用途)
4. 勾「Provide user access to the AWS Management Console」(可選,只給 CLI 用就不勾)
5. 下一步 → Permissions:

   **這裡是重點**。階段 3 你需要讓這個 user 能建 Lambda / API Gateway / DynamoDB / IAM Role / CloudFormation。

   選「Attach policies directly」→ 勾以下這些 AWS managed policies:
   - `AdministratorAccess` ✅(個人專案,簡單起見直接給 admin。如果你想嚴一點再分權限,但個人用先這樣)

   > ⚠️ 我知道 admin 看起來很大,但對個人專案來說管理多個細粒度 policy 比被盜用的風險還高。**真正的安全來自 MFA 與 access key 的妥善保管**,不是 policy 顆粒度。

6. 建好 user 後,進入 user 詳細頁 → 「Security credentials」→ 「Create access key」
7. 用途選「Command Line Interface (CLI)」
8. 下一步,**把 Access key ID 和 Secret access key 存下來**(secret 只看得到一次,關掉視窗就沒了)

> 存哪裡:可以暫時存到 Apple Notes / 1Password / 任何安全的地方。**不要 commit 進 git**。

---

## Step 4:設定 Billing Alert(必做!)

這步預防被收冤枉錢。

### 4.1 啟用 IAM User 看 billing 的權限

1. **用 root 帳號登入**(不是 IAM user)
2. 右上角頭像 → 「Account」
3. 滾到「IAM User and Role Access to Billing Information」→ Edit
4. 勾「Activate IAM Access」→ Update

(這步是 AWS 設計的詭異雞生蛋:billing 預設只有 root 能看,要 root 開權限給 IAM user)

### 4.2 建 budget alert

切回 IAM User(或繼續用 root)。

1. AWS Console 搜尋「Billing」
2. 左側「Budgets」→ 「Create budget」
3. 選「Use a template (simplified)」
4. 選「Monthly cost budget」
5. 填:
   - Budget name: `total-monthly-budget`
   - Budgeted amount: `$5`(設低一點,任何超過都通知)
   - Email recipients: 你常看的 email
6. Create budget

設好之後,**只要你的 AWS 月花費接近 $5 / 達到 $5 / 超過 $5,就會寄 email 給你**。

### 4.3(選做但建議)再加一個「日花費」alert

1. Budgets → Create budget → Customize (advanced)
2. Budget type: Cost budget
3. Period: Daily
4. Amount: `$1`
5. Alert: 達到 80% 就 email

這樣每天有任何不正常花費你立刻知道。

---

## Step 5:在你電腦上裝 AWS CLI + 設定 credentials

### 5.1 裝 AWS CLI

Mac:
```bash
brew install awscli
```

驗證:
```bash
aws --version
# 應該看到 aws-cli/2.x.x ...
```

### 5.2 設定 credentials

```bash
aws configure
```

它會問你 4 個東西,照剛才存下來的填:
```
AWS Access Key ID:     <貼上 Step 3 拿到的 access key>
AWS Secret Access Key: <貼上 Step 3 拿到的 secret key>
Default region name:   us-east-1
Default output format: json
```

### 5.3 驗證可以連到 AWS

```bash
aws sts get-caller-identity
```

應該回一段 JSON,有你的帳號 ID 和 IAM user ARN,類似:
```json
{
    "UserId": "AIDAXXX...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/cdk-deploy"
}
```

看到這個就代表 CLI 設定成功。

---

## Step 6:Bootstrap CDK(只做一次)

CDK 第一次用要在 AWS 上建一個放 build artifacts 的 S3 bucket。

```bash
# 還沒裝 cdk 的話先裝
npm install -g aws-cdk

# 驗證
cdk --version

# bootstrap(這一步會在你 AWS 帳號建幾個基礎資源)
cdk bootstrap aws://<你的帳號 ID>/us-east-1
```

帳號 ID 從 Step 5.3 的 `aws sts get-caller-identity` 拿。

完成這步後 CDK 就可以部署了。

---

## ✅ Part A 完成檢查

跟我說以下都過了,我就開始 Part B(寫 CDK 程式):

- [ ] AWS 帳號開好,root 啟用 MFA
- [ ] IAM User `cdk-deploy` 建好,access key 存好
- [ ] Billing alert 設好($5/月 + 可選 $1/日)
- [ ] `aws sts get-caller-identity` 回 JSON 成功
- [ ] `cdk bootstrap aws://<account>/us-east-1` 跑完沒錯

---

## 常見問題

### Q: 信用卡驗證會被收錢嗎?

不會。AWS 通常會收 $1 USD 又馬上退回(有些銀行會看到一筆 $1 pending 然後消失)。free tier 不會自動扣費。

### Q: 我家裡網路很慢,bootstrap 要等多久?

3–5 分鐘左右。CloudFormation 在背後建資源。

### Q: 我之前已經用過 AWS / 已經有帳號了

那你只要做 Step 4(billing alert,如果還沒設)、Step 5(CLI 設定)、Step 6(CDK bootstrap)就好。

### Q: 我設錯 billing alert,Step 4.2 的 budget 已建立但沒收到 email

通常是 email 跑進垃圾信箱。也可以進 Budgets 列表,點進那個 budget 看「Alerts」區塊,確認 email 有打對。

### Q: 階段結束後我想關掉所有東西停止計費

有兩種方式:
1. **CDK destroy**(階段 3 結束後我會教):一行指令把所有資源刪光
2. **直接關 AWS 帳號**:登入 root → Account → Close account。注意關掉後 90 天內可以恢復,90 天後永久刪除。

---

完成後跟我說「Part A 完成」,我接著做 Part B。
