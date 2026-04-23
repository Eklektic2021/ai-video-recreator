CREATE TABLE `projectTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(100) NOT NULL,
	`thumbnail` varchar(512),
	`defaultMood` varchar(100),
	`defaultGenre` varchar(100),
	`estimatedDuration` int,
	`sceneCount` int NOT NULL DEFAULT 1,
	`isPublic` enum('true','false') NOT NULL DEFAULT 'true',
	`rating` float DEFAULT 0,
	`ratingCount` int NOT NULL DEFAULT 0,
	`usageCount` int NOT NULL DEFAULT 0,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `templateRatings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` int NOT NULL,
	`userId` int NOT NULL,
	`rating` int NOT NULL,
	`review` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `templateRatings_id` PRIMARY KEY(`id`)
);
