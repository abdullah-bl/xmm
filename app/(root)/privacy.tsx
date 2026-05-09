import { LegalDocument } from '@/components/legal-document';

export default function PrivacyScreen() {
  return (
    <LegalDocument
      title="Privacy Policy"
      lastUpdated="May 2026"
      intro="This Privacy Policy explains what information the app collects, how it is used, and the choices you have. We collect the minimum needed to make the camera and film features work — nothing more."
      sections={[
        {
          heading: 'Information We Collect',
          paragraphs: [
            'Photos you capture stay on your device and inside your private app library. They are never uploaded to our servers.',
            'When you opt in to the Embed Location setting, we read your device location only at the moment a photo is taken and write it into the photo file. The location is not transmitted to us.',
            'Anonymous diagnostic data (device model, OS version, app version) is sent only when you tap Send Feedback, so we can reproduce the issue you describe.',
          ],
        },
        {
          heading: 'How We Use Information',
          paragraphs: [
            'We use the data above to operate the app, fix bugs you report, and improve the camera, film catalog, and update delivery.',
            'We do not sell your data, share it with advertisers, or use it for profiling.',
          ],
        },
        {
          heading: 'Third-Party Services',
          paragraphs: [
            'We use Expo Updates to deliver app updates. Update checks include a request to Expo containing your runtime version and platform.',
            'Film LUT files are downloaded from our backend. The request includes your IP address as a normal part of HTTPS networking; we do not log it.',
          ],
        },
        {
          heading: 'Permissions',
          paragraphs: [
            'Camera and Microphone — to capture photos and video.',
            'Photo Library — to save the photos you choose to export.',
            'Location (optional) — to embed location in photos when Embed Location is enabled.',
            'You can revoke any of these permissions in your device Settings at any time.',
          ],
        },
        {
          heading: 'Data Retention & Deletion',
          paragraphs: [
            'Photos remain on your device until you delete them from the app or your system Photos library.',
            'Feedback messages you submit are kept only as long as needed to investigate and respond. Email support@example.com to request deletion.',
          ],
        },
        {
          heading: 'Children',
          paragraphs: [
            'The app is not directed to children under 13. We do not knowingly collect data from children.',
          ],
        },
        {
          heading: 'Changes',
          paragraphs: [
            'If this policy materially changes, the “Last updated” date above will change and a notice will appear in the app.',
          ],
        },
      ]}
    />
  );
}
