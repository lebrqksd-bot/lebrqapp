import AppHeader from '@/components/AppHeader';
import PerformanceTeamProfileCard from '@/components/item/PerformanceTeamProfileCard';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { ItemsAPI, type CatalogItem } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_BASE = CONFIG.API_BASE_URL;
const API_ORIGIN = API_BASE.replace(/\/?api\/?$/, '');

function toAbsoluteUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/static')) return `${API_ORIGIN}${url}`;
  return url;
}

type PerformanceTeam = CatalogItem & {
  video_url?: string | null;
  profile_image_url?: string | null;
  profile_info?: string | null;
  performance_team_profile?: any;
};

export default function PerformanceTeamsPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [teams, setTeams] = useState<PerformanceTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<PerformanceTeam | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<number | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    about: true,
    videos: false,
    members: false,
    experience: false,
    achievements: false,
  });

  const isLargeScreen = width >= 768;
  const numColumns = useMemo(() => {
    if (width >= 1200) return 3;
    if (width >= 768) return 2;
    return 1;
  }, [width]);

  const loadTeams = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await ItemsAPI.list({ category: 'team' });
      setTeams(response.items as PerformanceTeam[]);
    } catch (error) {
      console.error('Failed to load performance teams:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    // Set first team as active tab when teams are loaded
    if (teams.length > 0 && activeTab === null) {
      setActiveTab(0);
      setSelectedTeam(teams[0]);
    }
  }, [teams]);

  const handleTabPress = (index: number) => {
    setActiveTab(index);
    setSelectedTeam(teams[index]);
    // Reset expanded sections when switching tabs
    setExpandedSections({
      about: true,
      videos: false,
      members: false,
      experience: false,
      achievements: false,
    });
    // Scroll to top of details
    setTimeout(() => {
      // Scroll to details section
    }, 100);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadTeams(true);
  };

  const openTeamDetail = (team: PerformanceTeam) => {
    setSelectedTeam(team);
  };

  const closeTeamDetail = () => {
    setSelectedTeam(null);
  };

  const handleWatchVideo = (videoUrl: string) => {
    if (Platform.OS === 'web') {
      // On web, the iframe will handle it
      return;
    }
    Linking.openURL(videoUrl);
  };

  const getVideoEmbedUrl = (url: string): string => {
    // Convert YouTube URLs to embed format
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader title="Performance Teams" />
      <View style={styles.mainContainer}>
        {loading && teams.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <ThemedText style={styles.loadingText}>Loading performance teams...</ThemedText>
          </View>
        ) : teams.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="musical-notes-outline" size={64} color="#9CA3AF" />
            <ThemedText style={styles.emptyTitle}>No Performance Teams Available</ThemedText>
            <ThemedText style={styles.emptyText}>Check back later for exciting performances!</ThemedText>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <ThemedText style={styles.pageTitle}>Our Performance Teams</ThemedText>
              <ThemedText style={styles.pageSubtitle}>
                Discover talented performers ready to make your event memorable
              </ThemedText>
            </View>

            {/* Tab Navigation */}
            {teams.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabsContainer}
                style={styles.tabsScrollView}
              >
                {teams.map((team, index) => {
                  const profile = team.performance_team_profile;
                  const teamName = profile?.team_name || team.name;
                  const isActive = activeTab === index;
                  
                  return (
                    <TouchableOpacity
                      key={team.id}
                      style={[styles.tab, isActive && styles.tabActive]}
                      onPress={() => handleTabPress(index)}
                      activeOpacity={0.7}
                    >
                      {team.profile_image_url || team.image_url ? (
                        <Image
                          source={{ uri: toAbsoluteUrl(team.profile_image_url || team.image_url) }}
                          style={styles.tabImage}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={[styles.tabImage, styles.tabImagePlaceholder]}>
                          <Ionicons name="musical-notes" size={24} color="#9CA3AF" />
                        </View>
                      )}
                      <ThemedText style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>
                        {teamName}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Team Details Content */}
            {selectedTeam && activeTab !== null && (
              <View style={styles.detailsContainer}>
                {/* Render the detailed profile view here */}
                {(() => {
                  const profile = selectedTeam.performance_team_profile;
                  const teamName = profile?.team_name || selectedTeam.name;
                  const specialties = profile?.specialties || [];
                  const genres = profile?.genres || [];
                  const teamMembers = profile?.team_members || [];
                  const experience = profile?.experience || [];
                  const achievements = profile?.achievements || [];
                  const establishedYear = profile?.established_year;
                  const totalExperience = profile?.total_experience;
                  const performanceVideos = profile?.performance_videos || [];

                  return (
                    <ScrollView style={styles.detailsScrollView} showsVerticalScrollIndicator={false}>
                      {/* Profile Header Section */}
                      <View style={styles.detailsHeader}>
                        <View style={styles.detailsProfileImageWrapper}>
                          {selectedTeam.profile_image_url ? (
                            <Image
                              source={{ uri: toAbsoluteUrl(selectedTeam.profile_image_url) }}
                              style={styles.detailsProfileImage}
                              contentFit="cover"
                            />
                          ) : selectedTeam.image_url ? (
                            <Image
                              source={{ uri: toAbsoluteUrl(selectedTeam.image_url) }}
                              style={styles.detailsProfileImage}
                              contentFit="cover"
                            />
                          ) : (
                            <View style={[styles.detailsProfileImage, styles.detailsProfileImagePlaceholder]}>
                              <Ionicons name="musical-notes" size={64} color="#fff" />
                            </View>
                          )}
                        </View>
                        <ThemedText style={styles.detailsTeamName}>{teamName}</ThemedText>
                        {(selectedTeam.category || selectedTeam.subcategory) && (
                          <View style={styles.detailsCategoryRow}>
                            {selectedTeam.category && (
                              <View style={styles.detailsCategoryChip}>
                                <ThemedText style={styles.detailsCategoryChipText}>{selectedTeam.category}</ThemedText>
                              </View>
                            )}
                            {selectedTeam.subcategory && (
                              <View style={styles.detailsCategoryChipSecondary}>
                                <ThemedText style={styles.detailsCategoryChipText}>{selectedTeam.subcategory}</ThemedText>
                              </View>
                            )}
                          </View>
                        )}
                        <View style={styles.detailsStatsRow}>
                          {establishedYear && (
                            <View style={styles.detailsStatItem}>
                              <Ionicons name="calendar" size={20} color="#667eea" />
                              <ThemedText style={styles.detailsStatLabel}>Est. {establishedYear}</ThemedText>
                            </View>
                          )}
                          {totalExperience && (
                            <View style={styles.detailsStatItem}>
                              <Ionicons name="time" size={20} color="#667eea" />
                              <ThemedText style={styles.detailsStatLabel}>{totalExperience}</ThemedText>
                            </View>
                          )}
                          {teamMembers.length > 0 && (
                            <View style={styles.detailsStatItem}>
                              <Ionicons name="people" size={20} color="#667eea" />
                              <ThemedText style={styles.detailsStatLabel}>{teamMembers.length} Members</ThemedText>
                            </View>
                          )}
                          {(performanceVideos.length > 0 || selectedTeam.video_url) && (
                            <View style={styles.detailsStatItem}>
                              <Ionicons name="play-circle" size={20} color="#667eea" />
                              <ThemedText style={styles.detailsStatLabel}>{performanceVideos.length || 1}+ Videos</ThemedText>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Price and Book Button */}
                      <View style={styles.detailsActionSection}>
                        <View style={styles.detailsPriceSection}>
                          <ThemedText style={styles.detailsPriceLabel}>Starting Price</ThemedText>
                          <ThemedText style={styles.detailsPriceValue}>₹{Math.round(selectedTeam.price || 0)}</ThemedText>
                        </View>
                        <TouchableOpacity
                          style={styles.detailsBookButton}
                          onPress={() => router.push('/venue/grant-hall')}
                        >
                          <Ionicons name="calendar" size={20} color="#fff" />
                          <ThemedText style={styles.detailsBookButtonText}>Book This Team</ThemedText>
                        </TouchableOpacity>
                      </View>

                      {/* Expandable About Section */}
                      {(profile?.detailed_bio || selectedTeam.description || selectedTeam.profile_info) && (
                        <View style={styles.expandableSection}>
                          <TouchableOpacity
                            style={styles.expandableHeader}
                            onPress={() => setExpandedSections(prev => ({ ...prev, about: !prev.about }))}
                          >
                            <View style={styles.expandableHeaderContent}>
                              <Ionicons name="information-circle" size={24} color="#2563EB" />
                              <ThemedText style={styles.expandableTitle}>About</ThemedText>
                            </View>
                            <Ionicons
                              name={expandedSections.about ? 'chevron-up' : 'chevron-down'}
                              size={24}
                              color="#6B7280"
                            />
                          </TouchableOpacity>
                          {expandedSections.about && (
                            <View style={styles.expandableContent}>
                              {profile?.detailed_bio && (
                                <ThemedText style={styles.expandableText}>{profile.detailed_bio}</ThemedText>
                              )}
                              {selectedTeam.description && !profile?.detailed_bio && (
                                <ThemedText style={styles.expandableText}>{selectedTeam.description}</ThemedText>
                              )}
                              {selectedTeam.profile_info && !profile?.detailed_bio && !selectedTeam.description && (
                                <ThemedText style={styles.expandableText}>{selectedTeam.profile_info}</ThemedText>
                              )}
                            </View>
                          )}
                        </View>
                      )}

                      {/* Specialties & Genres */}
                      {(specialties.length > 0 || genres.length > 0) && (
                        <View style={styles.expandableSection}>
                          <View style={styles.expandableHeader}>
                            <View style={styles.expandableHeaderContent}>
                              <Ionicons name="star" size={24} color="#F59E0B" />
                              <ThemedText style={styles.expandableTitle}>Specialties & Genres</ThemedText>
                            </View>
                          </View>
                          <View style={styles.expandableContent}>
                            {specialties.length > 0 && (
                              <View style={styles.detailsTagsRow}>
                                {specialties.map((spec: string, idx: number) => (
                                  <View key={idx} style={styles.detailsTag}>
                                    <ThemedText style={styles.detailsTagText}>{spec}</ThemedText>
                                  </View>
                                ))}
                              </View>
                            )}
                            {genres.length > 0 && (
                              <View style={styles.detailsTagsRow}>
                                {genres.map((genre: string, idx: number) => (
                                  <View key={`genre-${idx}`} style={[styles.detailsTag, styles.detailsGenreTag]}>
                                    <ThemedText style={styles.detailsTagText}>{genre}</ThemedText>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        </View>
                      )}

                      {/* Videos Section */}
                      {(selectedTeam.video_url || performanceVideos.length > 0) && (
                        <View style={styles.expandableSection}>
                          <TouchableOpacity
                            style={styles.expandableHeader}
                            onPress={() => setExpandedSections(prev => ({ ...prev, videos: !prev.videos }))}
                          >
                            <View style={styles.expandableHeaderContent}>
                              <Ionicons name="play-circle" size={24} color="#EF4444" />
                              <ThemedText style={styles.expandableTitle}>
                                Videos ({performanceVideos.length || 1})
                              </ThemedText>
                            </View>
                            <Ionicons
                              name={expandedSections.videos ? 'chevron-up' : 'chevron-down'}
                              size={24}
                              color="#6B7280"
                            />
                          </TouchableOpacity>
                          {expandedSections.videos && (
                            <View style={styles.expandableContent}>
                              {performanceVideos.map((video: any, idx: number) => (
                                <View key={idx} style={styles.videoItem}>
                                  <ThemedText style={styles.videoItemTitle}>{video.title || `Video ${idx + 1}`}</ThemedText>
                                  {video.url && (
                                    Platform.OS === 'web' ? (
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
                                        style={styles.videoButton}
                                        onPress={() => handleWatchVideo(video.url)}
                                      >
                                        <View style={styles.videoButtonContent}>
                                          <Ionicons name="play-circle" size={64} color="#EF4444" />
                                          <ThemedText style={styles.videoButtonText}>Watch Video</ThemedText>
                                        </View>
                                      </TouchableOpacity>
                                    )
                                  )}
                                </View>
                              ))}
                              {selectedTeam.video_url && performanceVideos.length === 0 && (
                                <View style={styles.videoItem}>
                                  {Platform.OS === 'web' ? (
                                    <View style={styles.videoContainer}>
                                      <iframe
                                        src={getVideoEmbedUrl(selectedTeam.video_url)}
                                        style={styles.videoIframe}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                      />
                                    </View>
                                  ) : (
                                    <TouchableOpacity
                                      style={styles.videoButton}
                                      onPress={() => handleWatchVideo(selectedTeam.video_url!)}
                                    >
                                      <View style={styles.videoButtonContent}>
                                        <Ionicons name="play-circle" size={64} color="#EF4444" />
                                        <ThemedText style={styles.videoButtonText}>Watch Performance Video</ThemedText>
                                      </View>
                                    </TouchableOpacity>
                                  )}
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      )}

                      {/* Team Members Section */}
                      {teamMembers.length > 0 && (
                        <View style={styles.expandableSection}>
                          <TouchableOpacity
                            style={styles.expandableHeader}
                            onPress={() => setExpandedSections(prev => ({ ...prev, members: !prev.members }))}
                          >
                            <View style={styles.expandableHeaderContent}>
                              <Ionicons name="people" size={24} color="#10B981" />
                              <ThemedText style={styles.expandableTitle}>Team Members ({teamMembers.length})</ThemedText>
                            </View>
                            <Ionicons
                              name={expandedSections.members ? 'chevron-up' : 'chevron-down'}
                              size={24}
                              color="#6B7280"
                            />
                          </TouchableOpacity>
                          {expandedSections.members && (
                            <View style={styles.expandableContent}>
                              {teamMembers.map((member: any, idx: number) => (
                                <View key={idx} style={styles.memberCard}>
                                  {member.photo_url && (
                                    <Image
                                      source={{ uri: toAbsoluteUrl(member.photo_url) }}
                                      style={styles.memberPhoto}
                                      contentFit="cover"
                                    />
                                  )}
                                  <View style={styles.memberInfo}>
                                    <ThemedText style={styles.memberName}>{member.name}</ThemedText>
                                    {member.role && (
                                      <ThemedText style={styles.memberRole}>{member.role}</ThemedText>
                                    )}
                                    {member.bio && (
                                      <ThemedText style={styles.memberBio}>{member.bio}</ThemedText>
                                    )}
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      )}

                      {/* Experience Section */}
                      {experience.length > 0 && (
                        <View style={styles.expandableSection}>
                          <TouchableOpacity
                            style={styles.expandableHeader}
                            onPress={() => setExpandedSections(prev => ({ ...prev, experience: !prev.experience }))}
                          >
                            <View style={styles.expandableHeaderContent}>
                              <Ionicons name="star" size={24} color="#F59E0B" />
                              <ThemedText style={styles.expandableTitle}>Experience ({experience.length})</ThemedText>
                            </View>
                            <Ionicons
                              name={expandedSections.experience ? 'chevron-up' : 'chevron-down'}
                              size={24}
                              color="#6B7280"
                            />
                          </TouchableOpacity>
                          {expandedSections.experience && (
                            <View style={styles.expandableContent}>
                              {experience.map((exp: any, idx: number) => (
                                <View key={idx} style={styles.experienceCard}>
                                  <ThemedText style={styles.experienceTitle}>{exp.event_name}</ThemedText>
                                  {(exp.event_type || exp.date || exp.location) && (
                                    <View style={styles.experienceMeta}>
                                      {exp.event_type && (
                                        <ThemedText style={styles.experienceMetaText}>{exp.event_type}</ThemedText>
                                      )}
                                      {exp.date && (
                                        <ThemedText style={styles.experienceMetaText}>• {exp.date}</ThemedText>
                                      )}
                                      {exp.location && (
                                        <ThemedText style={styles.experienceMetaText}>• {exp.location}</ThemedText>
                                      )}
                                    </View>
                                  )}
                                  {exp.description && (
                                    <ThemedText style={styles.experienceDescription}>{exp.description}</ThemedText>
                                  )}
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      )}

                      {/* Achievements Section */}
                      {achievements.length > 0 && (
                        <View style={styles.expandableSection}>
                          <TouchableOpacity
                            style={styles.expandableHeader}
                            onPress={() => setExpandedSections(prev => ({ ...prev, achievements: !prev.achievements }))}
                          >
                            <View style={styles.expandableHeaderContent}>
                              <Ionicons name="trophy" size={24} color="#8B5CF6" />
                              <ThemedText style={styles.expandableTitle}>Achievements ({achievements.length})</ThemedText>
                            </View>
                            <Ionicons
                              name={expandedSections.achievements ? 'chevron-up' : 'chevron-down'}
                              size={24}
                              color="#6B7280"
                            />
                          </TouchableOpacity>
                          {expandedSections.achievements && (
                            <View style={styles.expandableContent}>
                              {achievements.map((achievement: any, idx: number) => (
                                <View key={idx} style={styles.achievementCard}>
                                  {achievement.image_url && (
                                    <Image
                                      source={{ uri: toAbsoluteUrl(achievement.image_url) }}
                                      style={styles.achievementImage}
                                      contentFit="cover"
                                    />
                                  )}
                                  <View style={styles.achievementInfo}>
                                    <View style={styles.achievementHeader}>
                                      <ThemedText style={styles.achievementTitle}>{achievement.title}</ThemedText>
                                      {achievement.year && (
                                        <View style={styles.achievementYear}>
                                          <ThemedText style={styles.achievementYearText}>{achievement.year}</ThemedText>
                                        </View>
                                      )}
                                    </View>
                                    {achievement.description && (
                                      <ThemedText style={styles.achievementDescription}>{achievement.description}</ThemedText>
                                    )}
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      )}
                    </ScrollView>
                  );
                })()}
              </View>
            )}
          </>
        )}
      </View>

      {/* Team Detail Modal - Profile Page Design */}
      <Modal
        visible={selectedTeam !== null}
        animationType="slide"
        transparent
        onRequestClose={closeTeamDetail}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeTeamDetail} />
          <View style={[styles.modalContent, { maxWidth: isLargeScreen ? 900 : '100%' }]}>
            {selectedTeam && (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
                {/* Colorful Header Background */}
                <View style={styles.profileHeader}>
                  <TouchableOpacity onPress={closeTeamDetail} style={styles.closeButton}>
                    <Ionicons name="close" size={28} color="#fff" />
                  </TouchableOpacity>
                  
                  {/* Centered Rounded Profile Image */}
                  <View style={styles.profileImageWrapper}>
                    {selectedTeam.profile_image_url ? (
                      <Image
                        source={{ uri: toAbsoluteUrl(selectedTeam.profile_image_url) }}
                        style={styles.profileImageLarge}
                        contentFit="cover"
                      />
                    ) : selectedTeam.image_url ? (
                      <Image
                        source={{ uri: toAbsoluteUrl(selectedTeam.image_url) }}
                        style={styles.profileImageLarge}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.profileImageLarge, styles.profileImagePlaceholder]}>
                        <Ionicons name="musical-notes" size={64} color="#fff" />
                      </View>
                    )}
                  </View>
                  
                  {/* Team Name */}
                  <ThemedText style={styles.profileName}>
                    {selectedTeam.performance_team_profile?.team_name || selectedTeam.name}
                  </ThemedText>
                  
                  {/* Quick Stats */}
                  <View style={styles.profileStats}>
                    {selectedTeam.performance_team_profile?.established_year && (
                      <View style={styles.statItem}>
                        <Ionicons name="calendar" size={18} color="#fff" />
                        <ThemedText style={styles.statText}>
                          Est. {selectedTeam.performance_team_profile.established_year}
                        </ThemedText>
                      </View>
                    )}
                    {selectedTeam.performance_team_profile?.team_members?.length > 0 && (
                      <View style={styles.statItem}>
                        <Ionicons name="people" size={18} color="#fff" />
                        <ThemedText style={styles.statText}>
                          {selectedTeam.performance_team_profile.team_members.length} Members
                        </ThemedText>
                      </View>
                    )}
                    {(selectedTeam.video_url || selectedTeam.performance_team_profile?.performance_videos?.length > 0) && (
                      <View style={styles.statItem}>
                        <Ionicons name="play-circle" size={18} color="#fff" />
                        <ThemedText style={styles.statText}>
                          {selectedTeam.performance_team_profile?.performance_videos?.length || 1}+ Videos
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </View>

                {/* Profile Content Section */}
                <View style={styles.profileContent}>
                  {/* Expandable About Section */}
                  {selectedTeam.performance_team_profile?.detailed_bio || selectedTeam.description || selectedTeam.profile_info ? (
                    <View style={styles.expandableSection}>
                      <TouchableOpacity
                        style={styles.expandableHeader}
                        onPress={() => setExpandedSections(prev => ({ ...prev, about: !prev.about }))}
                      >
                        <View style={styles.expandableHeaderContent}>
                          <Ionicons name="information-circle" size={24} color="#2563EB" />
                          <ThemedText style={styles.expandableTitle}>About</ThemedText>
                        </View>
                        <Ionicons
                          name={expandedSections.about ? 'chevron-up' : 'chevron-down'}
                          size={24}
                          color="#6B7280"
                        />
                      </TouchableOpacity>
                      {expandedSections.about && (
                        <View style={styles.expandableContent}>
                          {selectedTeam.performance_team_profile?.detailed_bio && (
                            <ThemedText style={styles.expandableText}>
                              {selectedTeam.performance_team_profile.detailed_bio}
                            </ThemedText>
                          )}
                          {selectedTeam.description && !selectedTeam.performance_team_profile?.detailed_bio && (
                            <ThemedText style={styles.expandableText}>{selectedTeam.description}</ThemedText>
                          )}
                          {selectedTeam.profile_info && !selectedTeam.performance_team_profile?.detailed_bio && !selectedTeam.description && (
                            <ThemedText style={styles.expandableText}>{selectedTeam.profile_info}</ThemedText>
                          )}
                        </View>
                      )}
                    </View>
                  ) : null}

                  {/* Expandable Videos Section */}
                  {(selectedTeam.video_url || selectedTeam.performance_team_profile?.performance_videos?.length > 0) && (
                    <View style={styles.expandableSection}>
                      <TouchableOpacity
                        style={styles.expandableHeader}
                        onPress={() => setExpandedSections(prev => ({ ...prev, videos: !prev.videos }))}
                      >
                        <View style={styles.expandableHeaderContent}>
                          <Ionicons name="play-circle" size={24} color="#EF4444" />
                          <ThemedText style={styles.expandableTitle}>
                            Videos ({selectedTeam.performance_team_profile?.performance_videos?.length || 1})
                          </ThemedText>
                        </View>
                        <Ionicons
                          name={expandedSections.videos ? 'chevron-up' : 'chevron-down'}
                          size={24}
                          color="#6B7280"
                        />
                      </TouchableOpacity>
                      {expandedSections.videos && (
                        <View style={styles.expandableContent}>
                          {selectedTeam.performance_team_profile?.performance_videos?.map((video: any, idx: number) => (
                            <View key={idx} style={styles.videoItem}>
                              <ThemedText style={styles.videoItemTitle}>{video.title || `Video ${idx + 1}`}</ThemedText>
                              {video.url && (
                                Platform.OS === 'web' ? (
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
                                    style={styles.videoButton}
                                    onPress={() => handleWatchVideo(video.url)}
                                  >
                                    <View style={styles.videoButtonContent}>
                                      <Ionicons name="play-circle" size={64} color="#EF4444" />
                                      <ThemedText style={styles.videoButtonText}>Watch Video</ThemedText>
                                    </View>
                                  </TouchableOpacity>
                                )
                              )}
                            </View>
                          ))}
                          {selectedTeam.video_url && (!selectedTeam.performance_team_profile?.performance_videos || selectedTeam.performance_team_profile.performance_videos.length === 0) && (
                            <View style={styles.videoItem}>
                              {Platform.OS === 'web' ? (
                                <View style={styles.videoContainer}>
                                  <iframe
                                    src={getVideoEmbedUrl(selectedTeam.video_url)}
                                    style={styles.videoIframe}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                  />
                                </View>
                              ) : (
                                <TouchableOpacity
                                  style={styles.videoButton}
                                  onPress={() => handleWatchVideo(selectedTeam.video_url!)}
                                >
                                  <View style={styles.videoButtonContent}>
                                    <Ionicons name="play-circle" size={64} color="#EF4444" />
                                    <ThemedText style={styles.videoButtonText}>Watch Performance Video</ThemedText>
                                  </View>
                                </TouchableOpacity>
                              )}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Expandable Team Members Section */}
                  {selectedTeam.performance_team_profile?.team_members?.length > 0 && (
                    <View style={styles.expandableSection}>
                      <TouchableOpacity
                        style={styles.expandableHeader}
                        onPress={() => setExpandedSections(prev => ({ ...prev, members: !prev.members }))}
                      >
                        <View style={styles.expandableHeaderContent}>
                          <Ionicons name="people" size={24} color="#10B981" />
                          <ThemedText style={styles.expandableTitle}>
                            Team Members ({selectedTeam.performance_team_profile.team_members.length})
                          </ThemedText>
                        </View>
                        <Ionicons
                          name={expandedSections.members ? 'chevron-up' : 'chevron-down'}
                          size={24}
                          color="#6B7280"
                        />
                      </TouchableOpacity>
                      {expandedSections.members && (
                        <View style={styles.expandableContent}>
                          {selectedTeam.performance_team_profile.team_members.map((member: any, idx: number) => (
                            <View key={idx} style={styles.memberCard}>
                              {member.photo_url && (
                                <Image
                                  source={{ uri: toAbsoluteUrl(member.photo_url) }}
                                  style={styles.memberPhoto}
                                  contentFit="cover"
                                />
                              )}
                              <View style={styles.memberInfo}>
                                <ThemedText style={styles.memberName}>{member.name}</ThemedText>
                                {member.role && (
                                  <ThemedText style={styles.memberRole}>{member.role}</ThemedText>
                                )}
                                {member.bio && (
                                  <ThemedText style={styles.memberBio}>{member.bio}</ThemedText>
                                )}
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Expandable Experience Section */}
                  {selectedTeam.performance_team_profile?.experience?.length > 0 && (
                    <View style={styles.expandableSection}>
                      <TouchableOpacity
                        style={styles.expandableHeader}
                        onPress={() => setExpandedSections(prev => ({ ...prev, experience: !prev.experience }))}
                      >
                        <View style={styles.expandableHeaderContent}>
                          <Ionicons name="star" size={24} color="#F59E0B" />
                          <ThemedText style={styles.expandableTitle}>
                            Experience ({selectedTeam.performance_team_profile.experience.length})
                          </ThemedText>
                        </View>
                        <Ionicons
                          name={expandedSections.experience ? 'chevron-up' : 'chevron-down'}
                          size={24}
                          color="#6B7280"
                        />
                      </TouchableOpacity>
                      {expandedSections.experience && (
                        <View style={styles.expandableContent}>
                          {selectedTeam.performance_team_profile.experience.map((exp: any, idx: number) => (
                            <View key={idx} style={styles.experienceCard}>
                              <ThemedText style={styles.experienceTitle}>{exp.event_name}</ThemedText>
                              {(exp.event_type || exp.date || exp.location) && (
                                <View style={styles.experienceMeta}>
                                  {exp.event_type && (
                                    <ThemedText style={styles.experienceMetaText}>{exp.event_type}</ThemedText>
                                  )}
                                  {exp.date && (
                                    <ThemedText style={styles.experienceMetaText}>• {exp.date}</ThemedText>
                                  )}
                                  {exp.location && (
                                    <ThemedText style={styles.experienceMetaText}>• {exp.location}</ThemedText>
                                  )}
                                </View>
                              )}
                              {exp.description && (
                                <ThemedText style={styles.experienceDescription}>{exp.description}</ThemedText>
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Expandable Achievements Section */}
                  {selectedTeam.performance_team_profile?.achievements?.length > 0 && (
                    <View style={styles.expandableSection}>
                      <TouchableOpacity
                        style={styles.expandableHeader}
                        onPress={() => setExpandedSections(prev => ({ ...prev, achievements: !prev.achievements }))}
                      >
                        <View style={styles.expandableHeaderContent}>
                          <Ionicons name="trophy" size={24} color="#8B5CF6" />
                          <ThemedText style={styles.expandableTitle}>
                            Achievements ({selectedTeam.performance_team_profile.achievements.length})
                          </ThemedText>
                        </View>
                        <Ionicons
                          name={expandedSections.achievements ? 'chevron-up' : 'chevron-down'}
                          size={24}
                          color="#6B7280"
                        />
                      </TouchableOpacity>
                      {expandedSections.achievements && (
                        <View style={styles.expandableContent}>
                          {selectedTeam.performance_team_profile.achievements.map((achievement: any, idx: number) => (
                            <View key={idx} style={styles.achievementCard}>
                              {achievement.image_url && (
                                <Image
                                  source={{ uri: toAbsoluteUrl(achievement.image_url) }}
                                  style={styles.achievementImage}
                                  contentFit="cover"
                                />
                              )}
                              <View style={styles.achievementInfo}>
                                <View style={styles.achievementHeader}>
                                  <ThemedText style={styles.achievementTitle}>{achievement.title}</ThemedText>
                                  {achievement.year && (
                                    <View style={styles.achievementYear}>
                                      <ThemedText style={styles.achievementYearText}>{achievement.year}</ThemedText>
                                    </View>
                                  )}
                                </View>
                                {achievement.description && (
                                  <ThemedText style={styles.achievementDescription}>{achievement.description}</ThemedText>
                                )}
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Full Profile Card as Fallback */}
                  {selectedTeam.performance_team_profile && 
                   !selectedTeam.performance_team_profile.detailed_bio &&
                   !selectedTeam.performance_team_profile.team_members?.length &&
                   !selectedTeam.performance_team_profile.experience?.length &&
                   !selectedTeam.performance_team_profile.achievements?.length &&
                   !selectedTeam.performance_team_profile.performance_videos?.length && (
                    <View style={styles.modalSection}>
                      <PerformanceTeamProfileCard profile={selectedTeam.performance_team_profile} />
                    </View>
                  )}

                  {/* Category & Subcategory */}
                  {(selectedTeam.category || selectedTeam.subcategory) && (
                    <View style={styles.expandableSection}>
                      <View style={{ padding: 16, backgroundColor: '#F9FAFB' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <Ionicons name="pricetag" size={20} color="#2563EB" />
                          <ThemedText style={styles.expandableTitle}>Category</ThemedText>
                        </View>
                        <View style={styles.categoryRow}>
                          {selectedTeam.category && (
                            <View style={styles.categoryChip}>
                              <ThemedText style={styles.categoryChipText}>{selectedTeam.category}</ThemedText>
                            </View>
                          )}
                          {selectedTeam.subcategory && (
                            <View style={[styles.categoryChip, styles.categoryChipSecondary]}>
                              <ThemedText style={styles.categoryChipText}>{selectedTeam.subcategory}</ThemedText>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Price Section */}
                  <View style={[styles.expandableSection, styles.priceSection]}>
                    <View style={styles.priceRow}>
                      <View>
                        <ThemedText style={styles.priceSectionLabel}>Starting Price</ThemedText>
                        <ThemedText style={styles.priceSectionValue}>₹{Math.round(selectedTeam.price || 0)}</ThemedText>
                      </View>
                      <TouchableOpacity
                        style={styles.bookButton}
                        onPress={() => {
                          closeTeamDetail();
                          // Navigate to booking page or show booking options
                          router.push('/venue/grant-hall');
                        }}
                      >
                        <Ionicons name="calendar" size={20} color="#fff" />
                        <ThemedText style={styles.bookButtonText}>Book This Team</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  mainContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  tabsScrollView: {
    maxHeight: 120,
    marginBottom: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    gap: 8,
    minWidth: 120,
    maxWidth: 200,
  },
  tabActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  tabImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
  },
  tabImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#D1D5DB',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
    flex: 1,
  },
  tabTextActive: {
    color: '#fff',
  },
  detailsContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  detailsScrollView: {
    flex: 1,
  },
  detailsHeader: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  detailsProfileImageWrapper: {
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  detailsProfileImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 5,
    borderColor: '#fff',
    backgroundColor: '#E5E7EB',
  },
  detailsProfileImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#667eea',
  },
  detailsTeamName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  detailsCategoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  detailsCategoryChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  detailsCategoryChipSecondary: {
    backgroundColor: '#F3F4F6',
  },
  detailsCategoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
    textTransform: 'capitalize',
  },
  detailsStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    width: '100%',
  },
  detailsStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  detailsStatLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  detailsActionSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  detailsPriceSection: {
    flex: 1,
  },
  detailsPriceLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  detailsPriceValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#667eea',
  },
  detailsBookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  detailsBookButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  detailsTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  detailsTag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  detailsGenreTag: {
    backgroundColor: '#FDF4FF',
    borderColor: '#F9E8FF',
  },
  detailsTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E40AF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  header: {
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
  },
  grid: {
    gap: 16,
  },
  teamCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    ...(Platform.OS === 'web' && {
      transition: 'transform 0.2s, box-shadow 0.2s',
    }),
  },
  cardImageContainer: {
    width: '100%',
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  centeredImageWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredProfileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E5E7EB',
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#D1D5DB',
  },
  videoBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  videoBadgeCentered: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  videoBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  establishedBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.9)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  establishedBadgeCentered: {
    position: 'absolute',
    bottom: -8,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
    alignSelf: 'center',
    width: 80,
  },
  establishedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  teamName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  categoryBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexShrink: 0,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4F46E5',
    textTransform: 'capitalize',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metaText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  teamDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  tagText: {
    fontSize: 11,
    color: '#1E40AF',
    fontWeight: '500',
  },
  genreTag: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  moreTag: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  moreTagText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  highlightsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  highlightText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  priceContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2563EB',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '95%',
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  modalScroll: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 16,
  },
  closeButton: {
    padding: 4,
  },
  modalProfileContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#F9FAFB',
  },
  modalProfileImage: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#E5E7EB',
  },
  modalImageContainer: {
    padding: 20,
    paddingTop: 0,
  },
  modalImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  modalSection: {
    padding: 20,
    paddingTop: 0,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  sectionText: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 24,
  },
  videoContainer: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoIframe: {
    width: '100%',
    height: 400,
    border: 'none',
  },
  videoButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  videoButtonContent: {
    alignItems: 'center',
  },
  videoButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
    marginTop: 12,
  },
  videoButtonSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  categoryChipSecondary: {
    backgroundColor: '#F3F4F6',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4F46E5',
    textTransform: 'capitalize',
  },
  priceSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    margin: 20,
    marginTop: 0,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceSectionLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  priceSectionValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2563EB',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Profile Page Styles
  profileHeader: {
    backgroundColor: '#667eea',
    paddingTop: 60,
    paddingBottom: 100,
    paddingHorizontal: 20,
    alignItems: 'center',
    position: 'relative',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...(Platform.OS === 'web' ? {
      backgroundColor: '#667eea', // Fallback color for gradient
      // Note: For web, you may want to use a LinearGradient component instead
    } : {
      backgroundColor: '#667eea', // Solid color for mobile
    }),
  },
  profileImageWrapper: {
    marginTop: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  profileImageLarge: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 6,
    borderColor: '#fff',
    backgroundColor: '#E5E7EB',
  },
  profileImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#9CA3AF',
  },
  profileName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  profileStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  profileContent: {
    backgroundColor: '#fff',
    marginTop: -40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
    minHeight: 400,
  },
  expandableSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  expandableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
  },
  expandableHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  expandableTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  expandableContent: {
    padding: 16,
  },
  expandableText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#4B5563',
  },
  videoItem: {
    marginBottom: 16,
  },
  videoItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  memberCard: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 12,
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
    fontSize: 14,
    fontWeight: '500',
    color: '#2563EB',
    marginBottom: 4,
  },
  memberBio: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  experienceCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  experienceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  experienceMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  experienceMetaText: {
    fontSize: 13,
    color: '#6B7280',
  },
  experienceDescription: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  achievementCard: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  achievementImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  achievementInfo: {
    flex: 1,
  },
  achievementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  achievementYear: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  achievementYearText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  achievementDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
});

