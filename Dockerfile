# Base image
FROM node:20-alpine

# Set working directory
WORKDIR /

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy the prebuilt dist folder and other necessary files
COPY dist /

COPY  public ./public
COPY views ./views
COPY .env ./
COPY asserts ./asserts
COPY helpers ./helpers

# If needed, also copy config or static files
# COPY config ./config
# COPY public ./public

# Expose ports (adjust based on your app)
EXPOSE 5000 6000

# Start the app
CMD ["node", "app.js"]
