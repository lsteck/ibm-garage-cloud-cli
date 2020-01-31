import {KubeBody, KubeResource, KubeResourceList} from './kubernetes-resource-manager';
import {Inject, Provides} from 'typescript-ioc';
import * as _ from 'lodash';
import {AsyncKubeClient, KubeClient} from './client';
import {CommandTracker} from '../command-tracker/command-tracker';

export interface KindInstance<T extends KubeResource> {
  readonly kind: string;
  get(options?: any): Promise<KubeBody<T>>;
  post(body: KubeBody<T>): Promise<KubeBody<T>>;
  put(body: KubeBody<T>): Promise<KubeBody<T>>;
}

export interface KindClient<T extends KubeResource> {
  (name: string): KindInstance<T>;
  get(options?: any): Promise<KubeBody<KubeResourceList<T>>>;
  post(body: KubeBody<T>): Promise<KubeBody<T>>;
}

export abstract class KubeKindBuilder {
  abstract async getResourceNode<T extends KubeResource>(group: string | undefined, version: string, kind: string, namespace: string): Promise<KindClient<T> | undefined>;
  abstract registerCrdSchema(name: string): Promise<boolean>;
}

export interface CustomResourceDefinition extends KubeResource {
  spec: object;
  status?: object;
}

@Provides(KubeKindBuilder)
export class DefaultKubeKindBuilder implements KubeKindBuilder {
  @Inject
  asyncKubeClient: AsyncKubeClient;

  async getResourceNode<T extends KubeResource>(group: string | undefined, version: string, kind: string, namespace: string): Promise<KindClient<T> | undefined> {

    const client: KubeClient = await this.asyncKubeClient.get();

    const versionPath: string[] = !group
      ? ['api', version]
      : ['apis', group, version];

    const versionNode = _.get(client, versionPath);

    if (versionNode) {
      return _.get(versionNode.namespace(namespace), kind);
    }
  }

  async registerCrdSchema(name: string): Promise<boolean> {
    try {
      const client: KubeClient = await this.asyncKubeClient.get();

      const crd: KubeBody<CustomResourceDefinition> = await client.apis['apiextensions.k8s.io'].v1beta1.customresourcedefinitions(name).get();

      if (!crd || !crd.body) {
        return false;
      }

      client.addCustomResourceDefinition({
        metadata: {
          annotations: crd.body.metadata.annotations,
          name: crd.body.metadata.name
        },
        spec: crd.body.spec
      });

      return true;
    } catch (err) {
      return false;
    }
  }
}

function recordKubePayload(tracker: CommandTracker, command: string, namespace?: string) {
  return async <T extends KubeResource>(value: KubeBody<T>): Promise<KubeBody<T>> => {
    console.log('Adding step', value.body);

    const args = [command];
    if (namespace) {
      args.push('-n');
      args.push(namespace);
    }

    tracker.record({
      command: 'kubectl',
      arguments: args,
      data: value.body
    });
    return value;
  };
}

class KindInstanceWrapper<T extends KubeResource> implements KindInstance<T> {
  constructor(private kindInstance: KindInstance<T>, private namespace: string, private commandTracker: CommandTracker) {}

  get kind(): string {
    return this.kindInstance.kind;
  }

  async get(options?: any): Promise<KubeBody<T>> {
    this.commandTracker.record({
      command: 'kubectl',
      arguments: [
        'get',
        this.kindInstance.kind,
        '-n',
        this.namespace,
      ],
    });

    return this.kindInstance.get(options);
  }
  async post(body: KubeBody<T>): Promise<KubeBody<T>> {
    return recordKubePayload(this.commandTracker, 'apply', this.namespace)(body);
  }
  async put(body: KubeBody<T>): Promise<KubeBody<T>> {
    return recordKubePayload(this.commandTracker, 'create', this.namespace)(body);
  }
}

export class DryRunKindBuilder extends DefaultKubeKindBuilder implements KubeKindBuilder {

  @Inject
  commandTracker: CommandTracker;

  async getResourceNode<T extends KubeResource>(group: string | undefined, version: string, kind: string, namespace: string): Promise<KindClient<T>> {

    const originalKubeKind = await DefaultKubeKindBuilder.prototype.getResourceNode.bind(this)(group, version, kind, namespace);

    if (!originalKubeKind) {
      console.log('Original KubeKind not found', group, version, kind, namespace);
      return undefined;
    }

    return Object.assign(
      (name: string): KindInstance<T> => {
        return new KindInstanceWrapper(originalKubeKind(name), namespace, this.commandTracker);
      },
      {
        get: originalKubeKind.get.bind(originalKubeKind),
        post: recordKubePayload(this.commandTracker, 'apply', namespace),
      });
  }
}