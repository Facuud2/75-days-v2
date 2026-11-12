import dotenv from 'dotenv';

dotenv.config();

const required = (name: string): string => {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`[config] Missing required environment variable: ${name}`);
    return value;
};

export const config = {
    jwtSecret: required('JWT_SECRET'),
    internalApiKey: required('INTERNAL_API_KEY'),
};
