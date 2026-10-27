import { createClient } from "redis";

import { config } from "dotenv";
config({ path: "secret/.env" });

const client = createClient({
    url: 'redis://' + process.env.REDIS_HOST + ':' + process.env.REDIS_PORT
});

client.on('error', (err) => {
    console.log(`Error: ${err}`);
});

client.connect();

export default client;