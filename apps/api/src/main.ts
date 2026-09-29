import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global API prefix to /api/v1 per PRD 23 & 63
  app.setGlobalPrefix('api/v1');

  // Enable CORS for mobile app & admin dashboard
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Swagger OpenAPI documentation per PRD Section 62
  const config = new DocumentBuilder()
    .setTitle('Privity API')
    .setDescription(
      'Private-first social feed for real connections — REST API Specification',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 Privity API is running on http://localhost:${port}/api/v1`);
  console.log(`📑 OpenAPI Docs available at http://localhost:${port}/api/docs`);
}

bootstrap();
