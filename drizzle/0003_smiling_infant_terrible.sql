CREATE TABLE `shareAnalytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shareId` int NOT NULL,
	`platform` varchar(50) NOT NULL,
	`sharedAt` timestamp NOT NULL DEFAULT (now()),
	`clicks` int NOT NULL DEFAULT 0,
	`impressions` int NOT NULL DEFAULT 0,
	CONSTRAINT `shareAnalytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `socialShares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`shareToken` varchar(64) NOT NULL,
	`title` varchar(255),
	`description` text,
	`isPublic` int NOT NULL DEFAULT 1,
	`expiresAt` timestamp,
	`viewCount` int NOT NULL DEFAULT 0,
	`shareCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `socialShares_id` PRIMARY KEY(`id`),
	CONSTRAINT `socialShares_shareToken_unique` UNIQUE(`shareToken`)
);
--> statement-breakpoint
ALTER TABLE `shareAnalytics` ADD CONSTRAINT `shareAnalytics_shareId_socialShares_id_fk` FOREIGN KEY (`shareId`) REFERENCES `socialShares`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `socialShares` ADD CONSTRAINT `socialShares_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `socialShares` ADD CONSTRAINT `socialShares_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;