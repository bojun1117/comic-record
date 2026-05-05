import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb'
import { FIXED_USER_ID, type Manga, type MangaDbItem } from './types'

const TABLE_NAME = process.env.TABLE_NAME
if (!TABLE_NAME) {
  throw new Error('TABLE_NAME env var is required')
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
})

// 把 DB item 剝掉 userId 變成 API response 用的 Manga
function stripUserId(item: MangaDbItem): Manga {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { userId, ...manga } = item
  return manga
}

export async function listMangas(userId: string = FIXED_USER_ID): Promise<Manga[]> {
  const out = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
    }),
  )
  const items = (out.Items ?? []) as MangaDbItem[]
  return items.map(stripUserId)
}

export async function getManga(
  id: string,
  userId: string = FIXED_USER_ID,
): Promise<Manga | null> {
  const out = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { userId, id },
    }),
  )
  if (!out.Item) return null
  return stripUserId(out.Item as MangaDbItem)
}

export async function putManga(manga: Manga, userId: string = FIXED_USER_ID): Promise<void> {
  const item: MangaDbItem = { ...manga, userId }
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    }),
  )
}

export async function deleteManga(
  id: string,
  userId: string = FIXED_USER_ID,
): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { userId, id },
    }),
  )
}
