import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConstitutionModule } from './constitution/constitution.module';
import { TypesenseModule } from './typesense/typesense.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypesenseModule,
    ConstitutionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
