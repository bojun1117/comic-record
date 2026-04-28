// 從 SSM Parameter Store 拿 SecureString 並解密。
// 結果快取在 module 變數裡,Lambda 容器重用時不會重打 SSM。
// AWS SDK v3 由 Lambda runtime 內建,bundle 不會包它。

import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'

const ssm = new SSMClient({})

const cache = new Map<string, string>()

export async function getSecret(parameterName: string): Promise<string> {
  const cached = cache.get(parameterName)
  if (cached !== undefined) return cached

  const out = await ssm.send(
    new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true,
    }),
  )

  const value = out.Parameter?.Value
  if (!value) {
    throw new Error(`SSM parameter has no value: ${parameterName}`)
  }

  cache.set(parameterName, value)
  return value
}
