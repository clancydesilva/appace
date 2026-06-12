export const PRIVACY_POLICY_MD = `
# Privacy Policy for Appace

**Last Updated:** June 2026

Welcome to Appace ("we," "our," or "us"). Your privacy is incredibly important to us. This Privacy Policy explains how Appace handles data on your Android device.

## 1. Data Collection & Offline Functionality

Appace is designed to be a **100% offline application**. 
- We **do not** collect, transmit, or sell any of your personal information.
- We **do not** maintain servers to store your data.
- All screen time budgets, app usage statistics, and configuration settings are stored locally in a private database on your device.

## 2. AccessibilityService API Usage

Appace strictly requires the Android **AccessibilityService API** to function properly. 

### Why we need it
We use the Accessibility API solely to detect when you launch an application on your device. This allows us to track your usage of "tracked" apps and deduct time from your screen time budget accordingly.

### What data we access
When you open an app, the Accessibility API provides us with the "Package Name" (e.g., \`com.instagram.android\`) of the active window. We use this to determine if the app is on your restricted list.

### What we DO NOT do
- We **do not** read, record, or monitor the content on your screen (such as your messages, passwords, photos, or browser history).
- We **do not** log your keystrokes.
- We **do not** transmit your app usage history off your device. All monitoring is processed securely and entirely locally.

## 3. Data Retention and Deletion

Because all data is stored locally on your device via the Room Database:
- You have complete control over your data.
- You can delete all your screen time history and settings at any time simply by clearing the app data in your Android Settings or by uninstalling Appace.

## 4. Third-Party Services

Appace does not integrate with any third-party analytics trackers, crash reporters, or advertising networks. 

## 5. Changes to This Privacy Policy

We may update our Privacy Policy from time to time. Since the app is entirely offline, any updates to the policy will only reflect changes in local functionality or permissions required by the Android operating system. We will notify you of any major changes by updating the "Last Updated" date at the top of this page.

## 6. Contact Us

If you have any questions or suggestions regarding our Privacy Policy, please contact the developer via the GitHub repository or the email provided in the Google Play Store listing.
`;
