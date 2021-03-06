import {decode as base64decode} from '../../util/base64';
import {AbstractKubernetesResourceManager, KubeResource, ListOptions, Props} from './kubernetes-resource-manager';
import {Container, Provided, Provider} from 'typescript-ioc';
import {AsyncKubeClient, KubeClient} from './client';

export interface Secret extends KubeResource {
  type: string;
  stringData?: any;
  data?: any;
}

const provider: Provider = {
  get: () => {
    return new KubeSecret({
      client: Container.get(AsyncKubeClient),
      name: 'secrets',
      kind: 'Secret',
    });
  }
};

@Provided(provider)
export class KubeSecret extends AbstractKubernetesResourceManager<Secret> {
  constructor(props: Props) {
    super(props);
  }

  async getData<U>(secretName: string, namespace: string): Promise<U> {
    const secret: Secret = await this.get(secretName, namespace);

    if (!secret || !secret.data) {
      return {} as any;
    }

    return this.decodeSecretData(secret.data);
  }

  decodeSecretData<U>(secretData: U): any {
    return Object.keys(secretData).reduce((decodedResults, currentKey) => {
      if (secretData[currentKey]) {
        decodedResults[currentKey] = base64decode(secretData[currentKey]);
      }

      return decodedResults;
    }, {} as U);
  }

  async listData<U>(options: ListOptions<Secret>, exclude: string[] = []): Promise<U[]> {
    const secrets: Secret[] = await this.list(options);

    return secrets
      .filter(secret => !exclude.includes(secret.metadata.name))
      .map(secret => secret.data)
      .map(this.decodeSecretData);
  }
}
