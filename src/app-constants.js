// Zeekr app constants: the same for every user, extracted from the public Zeekr app
// (com.zeekr.global 1.5.5). The HMAC pair is the one the login gateway
// gateway-pub-hw-em-sg.zeekrlife.com accepts (EM), confirmed with a Singapore account.
// A secret or environment variable with the same name overrides a value here,
// e.g. after a Zeekr app update changes them.
export const APP_CONSTANTS = {
  HMAC_ACCESS_KEY: "edb79b1f68e0430ba192f856617bbcb7",
  HMAC_SECRET_KEY: "8ni9hp2v81ab165f5e744c808e5d48304b6df0e7",
  PASSWORD_PUBLIC_KEY:
    "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCBzg6+dwMVtGTNo8EPL+XFyz0OY0pMMo3HdRZGauuCSgISfVMkMmOhNEb2q9UfiQcEeOwVmOgts9VF4q0BJYrRNGQaPkLybwkWsx1JmbBRcr3qq+WWhqq8xQFksfn8KeXmwgVMFX+bzup43LE0vy0yyb+SuQ9FBBGuE1d/BfHHpQIDAQAB",
  PROD_SECRET: "890efe3207af95348b95f66b2ee7da04",
  VIN_KEY: "a01a6db985a2f5d4",
  VIN_IV: "ed446b8b8845013d",
};
