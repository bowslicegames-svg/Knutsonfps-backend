# Use official Node image
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of the app
COPY . .

# Expose Render's port
ENV PORT=8080
EXPOSE 8080

# Start the server
CMD ["npm", "start"]

