const CHANNEL_NAME = "activity-tracker-sync";
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  channel ??= new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

export function notifyDataChanged(): void {
  getChannel()?.postMessage({ type: "data-changed", at: Date.now() });
}

export function subscribeToDataChanges(callback: () => void): () => void {
  const activeChannel = getChannel();
  if (!activeChannel) return () => undefined;

  const listener = (event: MessageEvent) => {
    if (event.data?.type === "data-changed") callback();
  };

  activeChannel.addEventListener("message", listener);
  return () => activeChannel.removeEventListener("message", listener);
}
