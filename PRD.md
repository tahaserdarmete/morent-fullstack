## Authentication Workflow - MORENT Car Rental

### Overview

Implement user authentication using NextAuth, MongoDB, and Mongoose to allow users to register, log in, and log out. The authentication experience must visually align with the existing MORENT UI and be fully responsive.

### Goals

- Allow users to **register** with email, password, first name, last name, and optional phone.
- Allow users to **log in** with email and password.
- Provide a **logout** mechanism via NextAuth.
- Persist users in a **MongoDB `users` collection** using **Mongoose**.
- Reflect authentication state in the **header** (login/signup links vs. user avatar).

### Functional Requirements

#### Registration

- Provide a registration page at `/auth/register`.
- Collect the following fields:
  - `email` (required, unique)
  - `password` (required, minimum 6 characters)
  - `firstName` (required)
  - `lastName` (required)
  - `phone` (optional)
- Hash the password using `bcryptjs` before storing it.
- Save user data to MongoDB via a Mongoose `User` model.
- On successful registration, either:
  - Automatically sign the user in via NextAuth, or
  - Redirect them to the login page with a success message.

#### Login

- Provide a login page at `/auth/login`.
- Allow users to authenticate using **email + password** via a NextAuth **Credentials provider**.
- Show validation and error messages inline on the form.

#### Logout

- Expose a logout action using NextAuth’s `signOut` method.
- Ensure the session is properly cleared and the header updates accordingly.

### Data Model

#### User

- Backed by a MongoDB collection named `users` via Mongoose.
- Fields:
  - `email: string` (required, unique, lowercase)
  - `password: string` (required, hashed)
  - `firstName: string` (required)
  - `lastName: string` (required)
  - `phone?: string` (optional)
  - `image?: string` (optional, for profile picture URL used by NextAuth)
  - `createdAt: Date`
  - `updatedAt: Date`

### Technical Design

#### Dependencies

- Add and configure:
  - `next-auth` for authentication and session management.
  - `mongoose` for MongoDB ORM.
  - `bcryptjs` for password hashing and verification.
  - `@types/bcryptjs` and `@types/node` as needed for TypeScript types.

#### MongoDB Connection

- Implement a reusable MongoDB connection helper (e.g., `lib/mongodb.ts`) using Mongoose.
- Ensure connection is cached across requests to avoid re-connecting on every call.

#### NextAuth Configuration

- Implement NextAuth route in `app/api/auth/[...nextauth]/route.ts`.
- Use **Credentials provider**:
  - Look up user by email using Mongoose.
  - Validate password using `bcryptjs.compare`.
  - Return a minimal user object (`id`, `email`, `name`, `image`) to NextAuth.
- Configure:
  - `session.strategy = "jwt"`.
  - `callbacks` to include user `id` and basic profile data in the JWT and session.
- Rely on environment variables for secrets and MongoDB URI:
  - `AUTH_SECRET` (or `NEXTAUTH_SECRET` depending on NextAuth version).
  - `MONGODB_URI`.

#### Registration API

- Implement `POST /api/auth/register`:
  - Validate and sanitize incoming data.
  - Check for existing user with the same email.
  - Hash password with `bcryptjs`.
  - Create and save the user via Mongoose.
  - Return appropriate success or error JSON.

### UI & UX

#### Shared Requirements

- Follow the existing **MORENT** branding:
  - Typography and color palette similar to `Header` and `Home` page.
  - Use Tailwind CSS utilities for styling.
- Ensure full **responsiveness**:
  - Mobile-first layout.
  - Use container widths similar to the home page and header.
- Use clear form labels, placeholders, and validation messages.

#### Login Page (`/auth/login`)

- Centered card-style form on desktop, stacked layout on mobile.
- Inputs for email and password.
  -- Primary button for “Log in”.
  -- Link to “Create an account” that navigates to `/auth/register`.

#### Register Page (`/auth/register`)

- Similar layout and styling to login page for visual consistency.
- Inputs: first name, last name, email, phone (optional), password, confirm password.
- Inline error text for invalid or missing required fields.
- Primary button for “Create account”.
- Link to “Already have an account? Log in” that navigates to `/auth/login`.

### Header Behavior

- When **no user is authenticated**:
  - Show **Login** and **Sign up** buttons/links in the header that navigate to `/auth/login` and `/auth/register`, styled to match existing icon buttons and typography.
  - Hide the profile avatar and any user-only actions.
- When **user is authenticated**:
  - Show the user’s **profile picture** (or fallback avatar) instead of the current generic `User` icon.
  - Clicking the avatar should open a small menu or simple options including:
    - Link to “Profile” (placeholder / non-functional for now is acceptable).
    - “Logout” action that calls NextAuth `signOut`.
- Implement this with a small client-side component (e.g., `HeaderAuthSection`) using `next-auth/react`’s `useSession`, keeping the rest of the header as light as possible.

### Non-Goals (for this phase)

- No social login providers (Google, GitHub, etc.).
- No advanced profile management (editing profile, upload avatar).
- No roles/permissions system.
- No password reset or email verification flows.

### Implementation Phases

1. **Infrastructure & Model**

   - Add auth dependencies.
   - Implement MongoDB connection helper.
   - Implement Mongoose `User` model.

2. **Auth Backend**

   - Implement NextAuth configuration with credentials provider.
   - Implement registration API route.

3. **Auth UI**

   - Create login and register pages with responsive design aligned with existing UI.
   - Wire forms to registration and login endpoints with basic validation and error handling.

4. **Header Integration**
   - Add client-side `HeaderAuthSection` subcomponent.
   - Update header to conditionally show login/signup or avatar based on session.

---

## Car Listing Page - MORENT Car Rental

### Overview

Implement a dedicated car listing page at `/cars` that displays all available cars in a grid layout with filtering, sorting, search, and pagination. The page must closely follow the reference MORENT UI (filters sidebar + grid) and be fully responsive.

### Goals

- Allow users to browse all cars via a **grid-based listing**.
- Provide **filtering** by car type, location, price range, transmission, fuel type, and minimum number of seats.
- Provide **sorting** (e.g., price, rating, newest).
- Implement **search** by make/model.
- Support **pagination** with page size controls.
- Use the existing `/api/cars` endpoint as the **single source of data**, passing filters/sorting/pagination via query parameters.

### Functional Requirements

#### Route & Layout

- Page available at `/cars`.
- Use a two-column layout on desktop:
  - Left: filters panel.
  - Right: search bar, view controls (icon buttons), sorting, and grid of car cards.
- On mobile:
  - Filters collapse into a **toggleable panel** (e.g., “Filters” button).
  - Grid becomes one-column on very small screens, two-columns on small/medium screens.

#### Data Fetching

- The `/cars` page must **fetch cars via HTTP** from `/api/cars` using `fetch` on the client.
- The following query parameters must be supported and forwarded directly to `/api/cars`:
  - `search` → applied to both `make` and `modelName` (client translates to `make` / `model` when calling the API).
  - `carType`
  - `location`
  - `minPrice`
  - `maxPrice`
  - `transmission`
  - `fuelType`
  - `seats` (minimum seats)
  - `page` (1-based)
  - `limit` (page size)
  - `sortBy` (e.g., `pricePerDay`, `averageRating`, `createdAt`)
  - `sortOrder` (`asc` or `desc`)
- The client must keep filters/sorting/pagination **in sync with the URL search params** so that the page is shareable and back/forward navigation behaves correctly.

#### Filters

- **Car Type**:
  - Dropdown with options: `All Types`, `SUV`, `Sedan`, `Hatchback`, `Sports`, `Luxury`, `Crossover`.
  - Maps to `carType` query param (omit when “All Types”).
- **Location**:
  - Dropdown with a predefined list (e.g., `All Locations`, `New York`, `Los Angeles`, `San Francisco`, `Chicago`, `Miami`).
  - Maps to `location` query param.
- **Price Range (per day)**:
  - Two numeric inputs: `Min` and `Max`.
  - Maps to `minPrice` and `maxPrice` query params.
- **Transmission**:
  - Dropdown with options: `All Transmissions`, `Automatic`, `Manual`.
  - Maps to `transmission` query param.
- **Fuel Type**:
  - Dropdown with options: `All Fuel Types`, `Gasoline`, `Hybrid`, `Electric`, `Diesel`.
  - Maps to `fuelType` query param.
- **Number of Seats**:
  - Dropdown with options: `Any Number`, `2`, `4`, `5`, `7`, `8+`.
  - Maps to `seats` query param, using the number as a minimum.

#### Search & Sorting

- **Search bar**:
  - Text input labeled “Search cars…”.
  - When user submits (Enter or button click), update URL and trigger a new API call.
  - Client-side logic:
    - When search text is present, send it as both `make` and `model` filters to `/api/cars` (e.g., `make=query`, `model=query`) to reuse backend partial search.
- **Sorting**:
  - Dropdown near the right side above the grid with options:
    - `Recommended` → `sortBy=averageRating&sortOrder=desc` (default fallback to `createdAt desc` when rating is missing).
    - `Price: Low to High` → `sortBy=pricePerDay&sortOrder=asc`.
    - `Price: High to Low` → `sortBy=pricePerDay&sortOrder=desc`.
    - `Newest` → `sortBy=createdAt&sortOrder=desc`.
  - Selected sort persists in URL (`sortBy`, `sortOrder`) and re-applies on navigation.

#### Pagination

- Display **page numbers** below the grid, with previous/next buttons.
- Show current range and total count, e.g., “Showing 1–12 of 80 cars”.
- Support changing page size (`limit`) via a dropdown (e.g., `12`, `24`, `36`).
- Interactions must:
  - Update `page` and `limit` in the URL.
  - Trigger a new API request.
- Use the `pagination` object returned from `/api/cars`:
  - `total`, `page`, `limit`, `totalPages`.

#### UI & UX

- Layout should visually match the provided reference:
  - **Left filters card** with light background, vertical spacing, labels, and form controls.
  - **Right content area** with search bar, sort dropdown, view toggle icons (list icon can be non-functional for now), and car grid.
- Use existing `CarCard` component for individual car tiles.
- Use Tailwind CSS with a **mobile-first** approach:
  - `grid-cols-1` on small screens, `grid-cols-2` on medium, `grid-cols-3` or `grid-cols-4` on large.
- Show loading and error states:
  - Loading skeletons or spinner while the API request is in flight.
  - Error message with retry option if the API request fails.

#### Non-Goals (for this phase)

- No map view or advanced location-based search.
- No infinite scroll (use classic pagination only).
- No server-side rendering of the list data (filters must go through the `/api/cars` HTTP layer).

### Technical Design

- Create a dedicated client component (e.g., `CarsListingClient`) under `components/` to handle:
  - Local UI state for filters/search/sorting/pagination.
  - Synchronization with URL search params via `useSearchParams` and `useRouter`.
  - Fetching data from `/api/cars` with `fetch` using the query constructed from the current filter state.
- Create a server component page at `app/cars/page.tsx` that:
  - Defines metadata for the car listing.
  - Renders the shared layout shell and wraps the client component in `Suspense` with a loading fallback.
- Ensure the listing grid and filters use **pure functional components**, TypeScript interfaces, and Tailwind classes only (no custom CSS files).

### Implementation Phases (Car Listing)

1. **Listing Infrastructure**

   - Add `CarsListingClient` component with basic layout and dummy data.
   - Create `/cars` page that renders the client component.

2. **API Integration**

   - Wire the client component to call `/api/cars` with query params for filters, sorting, and pagination.
   - Implement loading, empty, and error states.

3. **Filters, Search, and Sorting**

   - Implement full filter panel, search bar, and sorting dropdown with URL synchronization.

4. **Pagination & Responsiveness**
   - Implement pagination controls and page size selector.
   - Refine responsive behavior to closely match the reference MORENT layout across breakpoints.
