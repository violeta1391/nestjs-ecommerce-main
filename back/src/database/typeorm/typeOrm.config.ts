import { config } from 'dotenv';
import { resolve } from 'path';
import { getEnvPath } from '../../common/helper/env.helper';

const envFilePath: string = getEnvPath(
  resolve(__dirname, '../..', 'common/envs'),
);

config({ path: envFilePath });

export const dataSourceOptions: any = {
  type: 'postgres',
  // Vercel / Neon: usa POSTGRES_URL como connection string
  // Docker local: usa variables individuales DATABASE_*
  ...(process.env.POSTGRES_URL
    ? {
        url: process.env.POSTGRES_URL,
        ssl: { rejectUnauthorized: false },
        extra: { max: 1 },
      }
    : {
        host: process.env.DATABASE_HOST,
        port: parseInt(process.env.DATABASE_PORT),
        username: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
      }),
  entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../history/*{.ts,.js}'],
  autoLoadEntities: true,
  synchronize: false,
};