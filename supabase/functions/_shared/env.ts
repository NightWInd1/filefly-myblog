function getDefaultKey(dictionaryName: string, legacyName: string): string | undefined {
	try {
		const keys = JSON.parse(Deno.env.get(dictionaryName) || "{}");
		if (typeof keys.default === "string" && keys.default) return keys.default;
	} catch {
		// Older projects may only expose the legacy default environment variables.
	}
	return Deno.env.get(legacyName);
}

export function getPublicKey(): string | undefined {
	return getDefaultKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
}

export function getSecretKey(): string | undefined {
	return getDefaultKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
}
