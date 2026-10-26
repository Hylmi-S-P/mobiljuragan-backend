-- AlterTable
ALTER TABLE `drivers` ADD COLUMN `licensePhotoUrl` LONGTEXT NULL,
    ADD COLUMN `licenseType` ENUM('SIM_A', 'SIM_B1', 'SIM_B2', 'SIM_C') NULL;
