import { type TypedPocketBase } from "@/types/backend.types";
import PocketBase from "pocketbase";



const pocketbaseUrl = process.env.EXPO_PUBLIC_POCKETBASE_URL!;
if (!pocketbaseUrl) {
    throw new Error("EXPO_PUBLIC_POCKETBASE_URL is not set");
}

const client = new PocketBase(pocketbaseUrl) as TypedPocketBase;

export default client;