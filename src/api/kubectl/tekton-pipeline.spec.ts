import {Container} from 'typescript-ioc';

import {mockKubeClientProvider} from './testHelper';
import {KubeClient} from './client';
import {KubeTektonTask} from "./tekton-task";
import {KubeTektonPipeline} from "./tekton-pipeline";

describe('tekton-pipeline', () => {
  test('canary verifies test infrastructure', () => {
    expect(true).toEqual(true);
  });

  describe('given KubeTektonPipeline', () => {
    let classUnderTest: KubeTektonPipeline;

    beforeEach(() => {
      Container
        .bind(KubeClient)
        .provider(mockKubeClientProvider);

      classUnderTest = Container.get(KubeTektonPipeline);
    });
  });
});
