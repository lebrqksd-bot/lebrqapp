/**
 * Comprehensive Performance Team Profile Card Component
 * Displays detailed performance team information in a beautiful card format
 */
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import React from 'react';
import {
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { ThemedText } from '../themed-text';
import { PerformanceTeamProfile } from './PerformanceTeamProfileForm';

interface PerformanceTeamProfileCardProps {
  profile: PerformanceTeamProfile | null | undefined;
  compact?: boolean;
}

import { CONFIG } from '@/constants/config';

const API_BASE = CONFIG.API_BASE_URL;
const API_ORIGIN = API_BASE.replace(/\/?api\/?$/, '');

function toAbsoluteUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/static')) return `${API_ORIGIN}${url}`;
  return url;
}

export default function PerformanceTeamProfileCard({
  profile,
  compact = false,
}: PerformanceTeamProfileCardProps) {
  if (!profile) return null;

  const getVideoEmbedUrl = (url: string): string => {
    if (url.includes('youtube.com/watch?v=')) {
      const videoId = url.split('v=')[1]?.split('&')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    return url;
  };

  const handleSocialLink = (url?: string) => {
    if (!url) return;
    Linking.openURL(url).catch((err) => console.error('Failed to open link:', err));
  };

  return (
    <ScrollView style={styles.container} nestedScrollEnabled showsVerticalScrollIndicator={false}>
      {/* Basic Information */}
      {(profile.team_name || profile.established_year || profile.total_experience || profile.detailed_bio) && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle" size={20} color="#2563EB" />
            <ThemedText style={styles.sectionTitle}>About the Team</ThemedText>
          </View>
          
          {profile.team_name && (
            <ThemedText style={styles.teamName}>{profile.team_name}</ThemedText>
          )}
          
          {(profile.established_year || profile.total_experience) && (
            <View style={styles.metaRow}>
              {profile.established_year && (
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                  <Text style={styles.metaText}>Est. {profile.established_year}</Text>
                </View>
              )}
              {profile.total_experience && (
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={16} color="#6B7280" />
                  <Text style={styles.metaText}>{profile.total_experience}</Text>
                </View>
              )}
            </View>
          )}
          
          {profile.detailed_bio && (
            <ThemedText style={styles.bio}>{profile.detailed_bio}</ThemedText>
          )}
        </View>
      )}

      {/* Specialties & Genres */}
      {((profile.specialties && profile.specialties.length > 0) || (profile.genres && profile.genres.length > 0)) && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="star-outline" size={20} color="#2563EB" />
            <ThemedText style={styles.sectionTitle}>Specialties & Genres</ThemedText>
          </View>
          
          {profile.specialties && profile.specialties.length > 0 && (
            <View style={styles.tagContainer}>
              {profile.specialties.map((spec, idx) => (
                <View key={idx} style={styles.tag}>
                  <Text style={styles.tagText}>{spec}</Text>
                </View>
              ))}
            </View>
          )}
          
          {profile.genres && profile.genres.length > 0 && (
            <View style={styles.tagContainer}>
              {profile.genres.map((genre, idx) => (
                <View key={idx} style={[styles.tag, styles.tagSecondary]}>
                  <Text style={styles.tagText}>{genre}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Team Members */}
      {profile.team_members && profile.team_members.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people-outline" size={20} color="#2563EB" />
            <ThemedText style={styles.sectionTitle}>Team Members</ThemedText>
          </View>
          
          <View style={styles.teamGrid}>
            {profile.team_members.map((member, idx) => (
              <View key={member.id || idx} style={styles.memberCard}>
                {member.photo_url && (
                  <ExpoImage
                    source={{ uri: toAbsoluteUrl(member.photo_url) }}
                    style={styles.memberPhoto}
                    contentFit="cover"
                  />
                )}
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name || 'Team Member'}</Text>
                  {member.role && (
                    <Text style={styles.memberRole}>{member.role}</Text>
                  )}
                  {member.bio && (
                    <Text style={styles.memberBio} numberOfLines={3}>{member.bio}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Performance Videos */}
      {profile.performance_videos && profile.performance_videos.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="videocam-outline" size={20} color="#2563EB" />
            <ThemedText style={styles.sectionTitle}>Performance Videos</ThemedText>
          </View>
          
          {profile.performance_videos.map((video, idx) => (
            <View key={video.id || idx} style={styles.videoCard}>
              {Platform.OS === 'web' ? (
                <View style={styles.videoContainer}>
                  <iframe
                    src={getVideoEmbedUrl(video.url)}
                    style={styles.videoIframe}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.videoPlaceholder}
                  onPress={() => Linking.openURL(video.url)}
                >
                  <Ionicons name="play-circle" size={64} color="#2563EB" />
                  <Text style={styles.videoButtonText}>{video.title || 'Watch Video'}</Text>
                </TouchableOpacity>
              )}
              {video.title && (
                <Text style={styles.videoTitle}>{video.title}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Experience & History */}
      {profile.experience && profile.experience.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy-outline" size={20} color="#2563EB" />
            <ThemedText style={styles.sectionTitle}>Experience & History</ThemedText>
          </View>
          
          {profile.experience.map((exp, idx) => (
            <View key={exp.id || idx} style={styles.experienceCard}>
              <View style={styles.experienceHeader}>
                <Text style={styles.experienceEventName}>{exp.event_name}</Text>
                {exp.date && (
                  <Text style={styles.experienceDate}>{exp.date}</Text>
                )}
              </View>
              {(exp.event_type || exp.location) && (
                <View style={styles.experienceMeta}>
                  {exp.event_type && (
                    <View style={styles.experienceMetaItem}>
                      <Ionicons name="pricetag-outline" size={14} color="#6B7280" />
                      <Text style={styles.experienceMetaText}>{exp.event_type}</Text>
                    </View>
                  )}
                  {exp.location && (
                    <View style={styles.experienceMetaItem}>
                      <Ionicons name="location-outline" size={14} color="#6B7280" />
                      <Text style={styles.experienceMetaText}>{exp.location}</Text>
                    </View>
                  )}
                </View>
              )}
              {exp.description && (
                <Text style={styles.experienceDescription}>{exp.description}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Achievements & Awards */}
      {profile.achievements && profile.achievements.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="medal-outline" size={20} color="#2563EB" />
            <ThemedText style={styles.sectionTitle}>Achievements & Awards</ThemedText>
          </View>
          
          <View style={styles.achievementsGrid}>
            {profile.achievements.map((achievement, idx) => (
              <View key={achievement.id || idx} style={styles.achievementCard}>
                {achievement.image_url && (
                  <ExpoImage
                    source={{ uri: toAbsoluteUrl(achievement.image_url) }}
                    style={styles.achievementImage}
                    contentFit="cover"
                  />
                )}
                <View style={styles.achievementContent}>
                  <View style={styles.achievementHeader}>
                    <Text style={styles.achievementTitle}>{achievement.title}</Text>
                    {achievement.year && (
                      <Text style={styles.achievementYear}>{achievement.year}</Text>
                    )}
                  </View>
                  {achievement.description && (
                    <Text style={styles.achievementDescription}>{achievement.description}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Notable Events */}
      {profile.notable_events && profile.notable_events.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar-outline" size={20} color="#2563EB" />
            <ThemedText style={styles.sectionTitle}>Notable Events</ThemedText>
          </View>
          
          <View style={styles.notableEventsList}>
            {profile.notable_events.map((event, idx) => (
              <View key={idx} style={styles.notableEventItem}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={styles.notableEventText}>{event}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Additional Info */}
      {((profile.languages && profile.languages.length > 0) || profile.performance_duration || profile.setup_time || profile.requirements) && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle-outline" size={20} color="#2563EB" />
            <ThemedText style={styles.sectionTitle}>Additional Information</ThemedText>
          </View>
          
          {profile.languages && profile.languages.length > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Languages:</Text>
              <View style={styles.tagContainer}>
                {profile.languages.map((lang, idx) => (
                  <View key={idx} style={styles.tag}>
                    <Text style={styles.tagText}>{lang}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          
          {(profile.performance_duration || profile.setup_time) && (
            <View style={styles.infoRow}>
              {profile.performance_duration && (
                <View style={styles.infoItem}>
                  <Ionicons name="time-outline" size={16} color="#6B7280" />
                  <Text style={styles.infoText}>Duration: {profile.performance_duration}</Text>
                </View>
              )}
              {profile.setup_time && (
                <View style={styles.infoItem}>
                  <Ionicons name="build-outline" size={16} color="#6B7280" />
                  <Text style={styles.infoText}>Setup: {profile.setup_time}</Text>
                </View>
              )}
            </View>
          )}
          
          {profile.requirements && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Requirements:</Text>
              <Text style={styles.infoText}>{profile.requirements}</Text>
            </View>
          )}
        </View>
      )}

      {/* Contact & Social Media */}
      {(profile.contact_email || profile.contact_phone || profile.website || profile.social_media) && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="call-outline" size={20} color="#2563EB" />
            <ThemedText style={styles.sectionTitle}>Contact & Social Media</ThemedText>
          </View>
          
          <View style={styles.contactGrid}>
            {profile.contact_email && (
              <TouchableOpacity
                style={styles.contactItem}
                onPress={() => Linking.openURL(`mailto:${profile.contact_email}`)}
              >
                <Ionicons name="mail-outline" size={20} color="#2563EB" />
                <Text style={styles.contactText}>{profile.contact_email}</Text>
              </TouchableOpacity>
            )}
            
            {profile.contact_phone && (
              <TouchableOpacity
                style={styles.contactItem}
                onPress={() => Linking.openURL(`tel:${profile.contact_phone}`)}
              >
                <Ionicons name="call-outline" size={20} color="#2563EB" />
                <Text style={styles.contactText}>{profile.contact_phone}</Text>
              </TouchableOpacity>
            )}
            
            {profile.website && (
              <TouchableOpacity
                style={styles.contactItem}
                onPress={() => handleSocialLink(profile.website)}
              >
                <Ionicons name="globe-outline" size={20} color="#2563EB" />
                <Text style={styles.contactText}>Website</Text>
              </TouchableOpacity>
            )}
            
            {profile.social_media?.facebook && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => handleSocialLink(profile.social_media?.facebook)}
              >
                <Ionicons name="logo-facebook" size={24} color="#1877F2" />
              </TouchableOpacity>
            )}
            
            {profile.social_media?.instagram && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => handleSocialLink(profile.social_media?.instagram)}
              >
                <Ionicons name="logo-instagram" size={24} color="#E4405F" />
              </TouchableOpacity>
            )}
            
            {profile.social_media?.youtube && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => handleSocialLink(profile.social_media?.youtube)}
              >
                <Ionicons name="logo-youtube" size={24} color="#FF0000" />
              </TouchableOpacity>
            )}
            
            {profile.social_media?.twitter && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => handleSocialLink(profile.social_media?.twitter)}
              >
                <Ionicons name="logo-twitter" size={24} color="#1DA1F2" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  teamName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#6B7280',
  },
  bio: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 24,
    marginTop: 8,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  tag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagSecondary: {
    backgroundColor: '#F3F4F6',
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4F46E5',
  },
  teamGrid: {
    gap: 16,
    marginTop: 12,
  },
  memberCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  memberPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E5E7EB',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  memberRole: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  memberBio: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  videoCard: {
    marginBottom: 16,
  },
  videoContainer: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 8,
  },
  videoIframe: {
    width: '100%',
    height: 300,
    border: 'none',
  },
  videoPlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  videoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
    marginTop: 8,
  },
  videoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  experienceCard: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 12,
  },
  experienceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  experienceEventName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  experienceDate: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 8,
  },
  experienceMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  experienceMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  experienceMetaText: {
    fontSize: 12,
    color: '#6B7280',
  },
  experienceDescription: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  achievementsGrid: {
    gap: 12,
    marginTop: 12,
  },
  achievementCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  achievementImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  achievementContent: {
    flex: 1,
  },
  achievementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  achievementTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  achievementYear: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 8,
  },
  achievementDescription: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  notableEventsList: {
    gap: 12,
    marginTop: 8,
  },
  notableEventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
  },
  notableEventText: {
    fontSize: 14,
    color: '#166534',
    flex: 1,
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  contactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    flex: 1,
    minWidth: '45%',
  },
  contactText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '500',
  },
  socialButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

