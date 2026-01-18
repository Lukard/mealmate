# API Overview

This document provides an overview of the Meal Automation REST API.

## Base URL

```
Production: https://api.mealautomation.es/v1
Development: http://localhost:3000/v1
```

## Authentication

All API requests require authentication using JWT tokens.

### Obtaining a Token

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password"
}
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600
}
```

### Using the Token

Include the token in the Authorization header:

```http
GET /meal-plans
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

## API Endpoints Summary

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Login user |
| POST | `/auth/register` | Register new user |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Logout user |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/me` | Get current user |
| PUT | `/users/me` | Update current user |
| DELETE | `/users/me` | Delete account |

### Preferences

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/preferences` | Get user preferences |
| PUT | `/preferences` | Update preferences |

### Meal Plans

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/meal-plans` | List meal plans |
| POST | `/meal-plans` | Generate new plan |
| GET | `/meal-plans/:id` | Get specific plan |
| PUT | `/meal-plans/:id` | Update plan |
| DELETE | `/meal-plans/:id` | Delete plan |

### Recipes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/recipes` | List recipes |
| GET | `/recipes/:id` | Get recipe details |
| POST | `/recipes` | Create custom recipe |

### Grocery Lists

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/grocery-lists` | List grocery lists |
| POST | `/grocery-lists` | Create from meal plan |
| GET | `/grocery-lists/:id` | Get specific list |
| PUT | `/grocery-lists/:id` | Update list |
| DELETE | `/grocery-lists/:id` | Delete list |

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/products` | Search products |
| GET | `/products/:id` | Get product details |

### Supermarkets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/supermarkets` | List supermarkets |
| GET | `/supermarkets/:id/products` | Get supermarket products |

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## Rate Limiting

- 100 requests per minute per user
- 1000 requests per hour per user
- Rate limit headers included in responses

## Pagination

List endpoints support pagination:

```http
GET /recipes?page=2&limit=20
```

Response includes:
```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

## Versioning

API versioned in URL path (`/v1/`). Breaking changes require new version.

## Further Documentation

- [Authentication Details](./authentication.md)
- [Endpoint Reference](./endpoints.md)
- [Error Handling](./errors.md)
- [Examples](./examples.md)
