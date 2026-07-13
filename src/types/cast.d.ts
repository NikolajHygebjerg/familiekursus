export {};

declare global {
  interface Window {
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    cast?: typeof cast;
  }

  class PresentationRequest {
    constructor(urls: string | string[]);
    start(): Promise<PresentationConnection>;
  }

  interface PresentationConnection {
    close(): void;
  }

  namespace JSX {
    interface IntrinsicElements {
      "google-cast-launcher": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }
}

declare namespace cast {
  namespace framework {
    class CastContext {
      static getInstance(): CastContext;
      setOptions(options: CastOptions): void;
      getCurrentSession(): CastSession | null;
      addEventListener(
        type: cast.framework.CastContextEventType,
        handler: (event: cast.framework.CastStateEventData) => void
      ): void;
      requestSession(): Promise<void>;
    }

    enum CastContextEventType {
      CAST_STATE_CHANGED = "caststatechanged",
      SESSION_STATE_CHANGED = "sessionstatechanged",
    }

    enum CastState {
      NO_DEVICES_AVAILABLE = "no_devices_available",
      NOT_CONNECTED = "not_connected",
      CONNECTING = "connecting",
      CONNECTED = "connected",
    }

    interface CastStateEventData {
      castState: CastState;
    }

    interface CastOptions {
      receiverApplicationId: string;
      autoJoinPolicy: "origin_scoped" | "page_scoped" | "tab_and_origin_scoped";
    }

    class CastSession {
      sendMessage(namespace: string, message: unknown): Promise<void>;
    }
  }
}
