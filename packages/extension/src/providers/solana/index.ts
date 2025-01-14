import { BaseNetwork } from '@/types/base-network';
import getRequestProvider, { RequestClass } from '@enkryptcom/request';
import { MiddlewareFunction, OnMessageResponse } from '@enkryptcom/types';
import Middlewares from './methods';
import EventEmitter from 'eventemitter3';
import {
  BackgroundProviderInterface,
  ProviderName,
  ProviderRPCRequest,
} from '@/types/provider';
import GetUIPath from '@/libs/utils/get-ui-path';
import PublicKeyRing from '@/libs/keyring/public-keyring';
import UIRoutes from './ui/routes/names';
import { SolanaNetwork } from './types/sol-network';
import Networks from './networks';

class SolanaProvider
  extends EventEmitter
  implements BackgroundProviderInterface
{
  network: SolanaNetwork;
  requestProvider: RequestClass;
  middlewares: MiddlewareFunction[] = [];
  namespace: string;
  KeyRing: PublicKeyRing;
  UIRoutes = UIRoutes;
  toWindow: (message: string) => void;
  constructor(
    toWindow: (message: string) => void,
    network: SolanaNetwork = Networks.solana,
  ) {
    super();
    this.network = network;
    this.toWindow = toWindow;
    this.setMiddleWares();
    this.requestProvider = getRequestProvider(
      this.network.node,
      this.middlewares,
    );
    this.requestProvider.on('notification', (notif: any) => {
      this.sendNotification(JSON.stringify(notif));
    });
    this.namespace = ProviderName.solana;
    this.KeyRing = new PublicKeyRing();
  }
  private setMiddleWares(): void {
    this.middlewares = Middlewares.map(mw => mw.bind(this));
  }
  setRequestProvider(network: BaseNetwork): void {
    this.network = network as SolanaNetwork;
    this.requestProvider.changeNetwork(network.node);
  }
  async isPersistentEvent(): Promise<boolean> {
    return false;
  }
  async sendNotification(notif: string): Promise<void> {
    return this.toWindow(notif);
  }
  request(request: ProviderRPCRequest): Promise<OnMessageResponse> {
    return this.requestProvider
      .request(request)
      .then(res => {
        return {
          result: JSON.stringify(res),
        };
      })
      .catch(e => {
        return {
          error: JSON.stringify(e.message),
        };
      });
  }
  getUIPath(page: string): string {
    return GetUIPath(page, this.namespace);
  }
}
export default SolanaProvider;
