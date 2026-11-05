-- CreateTable
CREATE TABLE "SetupCheck" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SetupCheck_pkey" PRIMARY KEY ("id")
);
