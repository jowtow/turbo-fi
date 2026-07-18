# turbo fi

I personal finance app themed after our cat Turbo.

## Purpose

This is an application primarily for me and my wife, but would also love for others to be able to pull the source code and self-host their own if desired in the future.

I currently have spreadsheets where I estimate our monthly expenses and earnings, but would like to be able to compare that estimate to our actual financial usage. This isn't intended to be a strict budget app where we must adhere to the strict guidelines or anything like that, but more of a way for us to track our actual spending trends and be more disciplined about looking at our monthly statements for all our accounts.

Key features should include defining accounts, expenses, and regular withdrawals / deposits amongst those various accounts. We should also be able to plan out our expected monthly expenses and then compare that to our actual expenses. The plan is to export our monthly credits and debits to a csv and be able to upload that to the site. All rows will be added to the database and then we will go through each line item and categorize so that we can ultimately compare our actual performance vs the expected results.

## Technical Requirements

This will be a web application. All components should run in containers and I should easily be able to develop against the solution using docker compose. Also, we should have VS Code tasks set up for each individual slice of the full stack.

The front-end will be developed in the following tech stack:

- React / TS / Vite
- TanStack Query & TanStack Table
- ShadCN Components & TailwindCSS
- Lucide Icons

The back-end will be developed in the following tech stack:

- C# .NET 10 LTS Web API w/ Controllers
- Entity Framework for interacting w/ database

The database will be SQL Server Express

Authentication can be fully run through .NET Identity for the initial implementation.
