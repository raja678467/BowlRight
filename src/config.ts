/**
 * API Configuration
 * 
 * IMPORTANT FOR PHYSICAL DEVICES:
 * 'localhost' only works on the emulator. To test on a real phone,
 * replace 'localhost' with your computer's internal IP address (e.g., 192.168.1.5).
 */
const DEFAULT_LOCAL_IP = '192.168.0.108'; // Your computer's IP found in logs
export const API_URL = process.env.EXPO_PUBLIC_API_URL || `http://${DEFAULT_LOCAL_IP}:8000`;
export const WS_URL = API_URL.replace('http', 'ws');
