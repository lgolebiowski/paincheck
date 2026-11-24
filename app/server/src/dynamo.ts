import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand, DeleteCommand, GetCommand, PutCommand, QueryCommand, type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { Repo } from './repo';
import type { PendingReminder, StoredSubscription } from './types';

/**
 * Single-table layout (partition key `pk`, sort key `sk`):
 *   SUB    / <endpoint>  push subscription
 *   REM    / <id>        pending reminder (TTL attribute `expiresAt` cleans up leftovers)
 *   CONFIG / vapid       VAPID key pair
 */
const SUB = 'SUB';
const REM = 'REM';
const CONFIG = 'CONFIG';
const TTL_GRACE_S = 60 * 60;

export interface VapidKeys { publicKey: string; privateKey: string }

export function createDynamoRepo(db: DynamoDBDocumentClient, table: string): Repo & {
  getVapid(): Promise<VapidKeys | null>;
  putVapidIfAbsent(keys: VapidKeys): Promise<boolean>;
} {
  async function queryAll(pk: string): Promise<Record<string, unknown>[]> {
    const items: Record<string, unknown>[] = [];
    let key: Record<string, unknown> | undefined;
    do {
      const res = await db.send(new QueryCommand({
        TableName: table, KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': pk },
        ConsistentRead: true, ExclusiveStartKey: key,
      }));
      items.push(...(res.Items ?? []));
      key = res.LastEvaluatedKey;
    } while (key);
    return items;
  }

  const toReminder = (i: Record<string, unknown>): PendingReminder => ({
    id: i.sk as string, dueAt: i.dueAt as number, kind: i.kind as PendingReminder['kind'],
    ...(i.drug ? { drug: i.drug as PendingReminder['drug'] } : {}),
  });

  return {
    async listSubscriptions() {
      return (await queryAll(SUB)).map((i) => ({ endpoint: i.sk as string, keys: i.keys as StoredSubscription['keys'], lang: i.lang as StoredSubscription['lang'] }));
    },
    async putSubscription(s) {
      await db.send(new PutCommand({ TableName: table, Item: { pk: SUB, sk: s.endpoint, keys: s.keys, lang: s.lang } }));
    },
    async deleteSubscription(endpoint) {
      await db.send(new DeleteCommand({ TableName: table, Key: { pk: SUB, sk: endpoint } }));
    },
    async putReminder(r) {
      await db.send(new PutCommand({
        TableName: table,
        Item: { pk: REM, sk: r.id, dueAt: r.dueAt, kind: r.kind, drug: r.drug, expiresAt: Math.floor(r.dueAt / 1000) + TTL_GRACE_S },
      }));
    },
    async getReminder(id) {
      const res = await db.send(new GetCommand({ TableName: table, Key: { pk: REM, sk: id }, ConsistentRead: true }));
      return res.Item ? toReminder(res.Item) : null;
    },
    async listReminders() {
      return (await queryAll(REM)).map(toReminder);
    },
    async deleteReminder(id) {
      try {
        await db.send(new DeleteCommand({ TableName: table, Key: { pk: REM, sk: id }, ConditionExpression: 'attribute_exists(pk)' }));
        return true;
      } catch (e) {
        if (e instanceof ConditionalCheckFailedException) return false;
        throw e;
      }
    },
    async deleteAllReminders() {
      const items = await queryAll(REM);
      for (let i = 0; i < items.length; i += 25) {
        await db.send(new BatchWriteCommand({
          RequestItems: { [table]: items.slice(i, i + 25).map((it) => ({ DeleteRequest: { Key: { pk: REM, sk: it.sk as string } } })) },
        }));
      }
      return items.length;
    },
    async getVapid() {
      const res = await db.send(new GetCommand({ TableName: table, Key: { pk: CONFIG, sk: 'vapid' }, ConsistentRead: true }));
      return res.Item ? { publicKey: res.Item.publicKey as string, privateKey: res.Item.privateKey as string } : null;
    },
    async putVapidIfAbsent(keys) {
      try {
        await db.send(new PutCommand({ TableName: table, Item: { pk: CONFIG, sk: 'vapid', ...keys }, ConditionExpression: 'attribute_not_exists(pk)' }));
        return true;
      } catch (e) {
        if (e instanceof ConditionalCheckFailedException) return false;
        throw e;
      }
    },
  };
}
