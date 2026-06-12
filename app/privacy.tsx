import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Markdown from 'react-native-markdown-display';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';

const PRIVACY_POLICY_URL = 'https://raw.githubusercontent.com/clancydesilva/appace/main/privacy_policy.md';

export default function PrivacyScreen() {
  const router = useRouter();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(PRIVACY_POLICY_URL)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch policy.');
        return res.text();
      })
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Privacy Policy Fetch Error:', err);
        setError('Could not load privacy policy. Please check your internet connection or read it on our website.');
        setLoading(false);
      });
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.contentContainer}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.textPrimary} />
            <Text style={styles.loadingText}>Loading policy...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => {
              setLoading(true);
              setError(null);
              fetch(PRIVACY_POLICY_URL)
                .then(r => r.text())
                .then(t => { setContent(t); setLoading(false); })
                .catch(e => { setError('Failed again.'); setLoading(false); });
            }}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <Markdown style={markdownStyles}>
              {content}
            </Markdown>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  placeholder: {
    width: 32, // Matches close button width
  },
  contentContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: Colors.textSecondary,
    marginTop: 16,
    fontSize: 14,
  },
  errorText: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: Colors.cardBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  retryText: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
  },
});

const markdownStyles = StyleSheet.create({
  body: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
  heading1: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 16,
  },
  heading2: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    paddingBottom: 8,
  },
  heading3: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  strong: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
  },
  em: {
    fontStyle: 'italic',
  },
  bullet_list: {
    marginBottom: 16,
  },
  list_item: {
    marginVertical: 4,
  },
  link: {
    color: '#3498db',
    textDecorationLine: 'none',
  },
  hr: {
    backgroundColor: Colors.border,
    height: 1,
    marginVertical: 24,
  },
  blockquote: {
    backgroundColor: Colors.cardBg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.borderAlt,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginVertical: 16,
    borderRadius: 4,
  },
});
