import {Arguments, Argv, CommandModule} from 'yargs';
import ora from 'ora';
import * as YAML from 'json2yaml';

import {DefaultOptionBuilder, YargsCommandDefinition} from '../../util/yargs-support';
import {CommandLineOptions} from '../../model';
import {getCredentials} from './credentials';

export const defineCredentialsCommand: YargsCommandDefinition = <T>(command: string): CommandModule<T> => {
  return {
    command,
    describe: 'register the pipeline in Jenkins for the repo',
    builder: (yargs: Argv<any>) => new DefaultOptionBuilder<any>(yargs)
      .kubeConfig({optional: false})
      .clusterNamespace({
        optional: true,
        describe: 'The cluster namespace where the credentials are stored',
        default: 'tools',
      })
      .quiet()
      .debug()
      .build()
      .option('yaml', {
        type: 'boolean',
        describe: 'print the result in yaml format'
      }),
    handler: async (argv: Arguments<{namespace: string; yaml: boolean} & CommandLineOptions>) => {
      let spinner;

      function statusCallback(status: string) {
        if (!spinner) {
          spinner = ora(status).start();
        } else {
          spinner.text = status;
        }
      }

      try {
        const result = await getCredentials(argv.namespace, statusCallback);

        if (spinner) {
          spinner.stop();
        }

        if (argv.yaml) {
          console.log('Credentials:');
          console.log(YAML.stringify(result));
        } else {
          console.log('Credentials: ', result);
        }

        process.exit(0);
      } catch (err) {
        if (spinner) {
          spinner.stop();
        }

        console.log('Error getting credentials:', err.message);
        if (argv.debug) {
          console.log('Error getting credentials:', err);
        }
        process.exit(1);
      }
    }
  };
};
