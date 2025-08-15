# transaction_simulator/Dockerfile
FROM node:18

# Set the working directory inside the container
WORKDIR /simulator

# Copy and install dependencies
COPY package.json package-lock.json ./
RUN npm install && npm rebuild sqlite3

# Copy the simulator code into the container
COPY . .

# Default command to start the simulator (if enabled)
CMD ["npm", "run", "dev"]
