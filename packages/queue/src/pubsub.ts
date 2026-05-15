import { PubSub, Message } from '@google-cloud/pubsub';
import { TOPICS } from './events';

let pubsub: PubSub;

function getPubSub(): PubSub {
  if (!pubsub) {
    pubsub = new PubSub({ projectId: process.env.GCP_PROJECT_ID });
  }
  return pubsub;
}

export async function publishEvent(
  topicName: string,
  data: Record<string, any>
): Promise<string> {
  const topic = getPubSub().topic(topicName);
  const messageBuffer = Buffer.from(JSON.stringify(data));
  const messageId = await topic.publishMessage({ data: messageBuffer });
  return messageId;
}

export async function subscribe(
  topicName: string,
  subscriptionName: string,
  handler: (message: any) => Promise<void>
): Promise<void> {
  const subscription = getPubSub().subscription(subscriptionName);
  subscription.on('message', async (message: Message) => {
    try {
      const data = JSON.parse(message.data.toString());
      await handler(data);
      message.ack();
    } catch (error) {
      console.error(`Error processing message from ${topicName}:`, error);
      message.nack();
    }
  });
}

export { TOPICS };
