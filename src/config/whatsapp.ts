import env from './env';

interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
  adminPhone: string;
  apiUrl: string;
}

const whatsappConfig: WhatsAppConfig = {
  phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
  accessToken: env.WHATSAPP_ACCESS_TOKEN,
  businessAccountId: env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  adminPhone: env.WHATSAPP_ADMIN_PHONE,
  apiUrl: `https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
};

export default whatsappConfig;
