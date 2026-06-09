process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "integration-test-jwt-secret-fixed";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://interview_app:localpass@localhost:5433/interview_app_test";
process.env.FRONTEND_URL = "http://localhost:3001";
process.env.AWS_S3_BUCKET = process.env.AWS_S3_BUCKET ?? "interview-app-local";
process.env.AWS_REGION = process.env.AWS_REGION ?? "us-east-1";
process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID ?? "minioadmin";
process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY ?? "minioadmin";
process.env.S3_ENDPOINT = process.env.S3_ENDPOINT ?? "http://localhost:9002";
process.env.S3_FORCE_PATH_STYLE = "true";
process.env.S3_PREFIX = process.env.S3_PREFIX ?? "test/";
process.env.SUPER_ADMIN_EMAILS = process.env.SUPER_ADMIN_EMAILS ?? "admin@test.local";
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "integration-google-client-id";
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "integration-google-client-secret";
process.env.GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:3000/auth/google/callback";

delete process.env.AI_PROVIDER;
delete process.env.OPENAI_API_KEY;
