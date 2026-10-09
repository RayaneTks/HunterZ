import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/production',workers:1,timeout:45000,expect:{timeout:10000},use:{baseURL:'http://127.0.0.1:4180',headless:true},webServer:{command:'node scripts/serve-preview.cjs',url:'http://127.0.0.1:4180',reuseExistingServer:false}});
