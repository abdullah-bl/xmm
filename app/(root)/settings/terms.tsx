import { LegalDocument } from '@/components/legal-document';

export default function TermsScreen() {
  return (
    <LegalDocument
      title="Terms of Service"
      lastUpdated="May 2026"
      intro="These Terms of Service govern your use of the app. By installing or using the app you agree to these terms."
      sections={[
        {
          heading: 'License',
          paragraphs: [
            'We grant you a limited, non-exclusive, non-transferable, revocable license to install and use the app on devices you own or control, for personal, non-commercial use.',
          ],
        },
        {
          heading: 'Acceptable Use',
          paragraphs: [
            'You agree not to misuse the app — for example, by attempting to reverse engineer it, redistribute the LUTs or other assets, or use the app to capture content that is illegal where you live.',
          ],
        },
        {
          heading: 'Content Ownership',
          paragraphs: [
            'You own the photos and videos you capture. We claim no rights over your content.',
            'Film LUTs and visual presets shipped with the app are licensed to you for use inside the app only.',
          ],
        },
        {
          heading: 'Updates & Changes',
          paragraphs: [
            'The app is delivered with over-the-air updates. New versions may add, remove, or change features. We try to keep changes backward-compatible but cannot guarantee it.',
          ],
        },
        {
          heading: 'Disclaimer',
          paragraphs: [
            'The app is provided “as is”, without warranties of any kind. We do not guarantee that the app will be error-free, uninterrupted, or that captured photos will always save successfully — please verify important shots.',
          ],
        },
        {
          heading: 'Limitation of Liability',
          paragraphs: [
            'To the fullest extent permitted by law, we are not liable for any indirect, incidental, or consequential damages arising from your use of the app, including loss of photos or data.',
          ],
        },
        {
          heading: 'Termination',
          paragraphs: [
            'You can stop using the app at any time by uninstalling it. We may suspend or terminate access if you violate these terms.',
          ],
        },
        {
          heading: 'Contact',
          paragraphs: [
            'Questions or disputes about these terms? Use the in-app Send Feedback option below.',
          ],
        },
      ]}
    />
  );
}
