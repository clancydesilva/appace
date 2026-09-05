import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Markdown from 'react-native-markdown-display';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '../constants/theme';
import { PRIVACY_POLICY_MD } from '../constants/PrivacyPolicy';

export default function PrivacyScreen() {
  const router = useRouter();

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
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <Markdown style={markdownStyles}>
            {PRIVACY_POLICY_MD}
          </Markdown>
        </ScrollView>
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
    fontFamily: Typography.fontFamily,
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
    fontFamily: Typography.fontFamily,
  },
  errorText: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
    lineHeight: 22,
    fontFamily: Typography.fontFamily,
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
    fontFamily: Typography.fontFamily,
  },
});

const markdownStyles = StyleSheet.create({
  body: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
    fontFamily: Typography.fontFamily,
  },
  heading1: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 16,
    fontFamily: Typography.fontFamily,
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
    fontFamily: Typography.fontFamily,
  },
  heading3: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: Typography.fontFamily,
  },
  strong: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
    fontFamily: Typography.fontFamily,
  },
  em: {
    fontStyle: 'italic',
    fontFamily: Typography.fontFamily,
  },
  bullet_list: {
    marginBottom: 16,
  },
  list_item: {
    marginVertical: 4,
    fontFamily: Typography.fontFamily,
  },
  link: {
    color: '#3498db',
    textDecorationLine: 'none',
    fontFamily: Typography.fontFamily,
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

