import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { decode } from 'html-entities';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ContentPage {
  page_name: string;
  title: string;
  content: string;
  meta_description?: string;
  updated_at: string;
}

export default function AboutPage() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 768;
  const [loading, setLoading] = useState(true);
  const [pageContent, setPageContent] = useState<ContentPage | null>(null);
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [founderName, setFounderName] = useState('Musthafa');
  const [founderTitle, setFounderTitle] = useState('Founder, LeBRQ');
  const [isExpanded, setIsExpanded] = useState(false);
  const [fullTextHeight, setFullTextHeight] = useState(0);
  const [collapsedTextHeight, setCollapsedTextHeight] = useState(0);
  const [imageSectionHeight, setImageSectionHeight] = useState(0);
  const [needsReadMore, setNeedsReadMore] = useState(false);
  const [hasMeasuredFull, setHasMeasuredFull] = useState(false);
  const [hasMeasuredCollapsed, setHasMeasuredCollapsed] = useState(false);

  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      try {
        // Add cache-busting query parameter using timestamp
        const cacheBuster = `?v=${Date.now()}`;
        const response = await fetch(`${CONFIG.API_BASE_URL}/content-pages/about${cacheBuster}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        });
        if (response.ok) {
          const data = await response.json();
          const decodedContent = decode(data.content);
          
          setPageContent({
            ...data,
            content: decodedContent,
            title: decode(data.title)
          });
          
          // Parse HTML content to extract paragraphs
          const paraMatches = decodedContent.match(/<p[^>]*>(.*?)<\/p>/gi);
          if (paraMatches && paraMatches.length > 0) {
            const extractedParas = paraMatches.map(p => {
              const text = p.replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .trim();
              return text;
            }).filter(p => p.length > 0);
            
            if (extractedParas.length > 0) {
              setParagraphs(extractedParas);
            } else {
              // Fallback: remove HTML tags and split by line breaks
              const textContent = decodedContent
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .trim();
              const fallbackParas = textContent
                .split(/\n\s*\n/)
                .map(p => p.trim())
                .filter(p => p.length > 0);
              setParagraphs(fallbackParas.length > 0 ? fallbackParas : [textContent]);
            }
        } else {
            // Fallback: remove HTML tags and split by line breaks
            const textContent = decodedContent
              .replace(/<[^>]*>/g, '')
              .replace(/&nbsp;/g, ' ')
              .trim();
            const fallbackParas = textContent
              .split(/\n\s*\n/)
              .map(p => p.trim())
              .filter(p => p.length > 0);
            setParagraphs(fallbackParas.length > 0 ? fallbackParas : [textContent]);
          }
        } else {
          // Use default content if API fails
          setParagraphs([
            'LeBRQ began as a vision to create a seamless platform for booking world-class venues, live shows, and entertainment experiences. We bridge the gap between event organizers and audiences, making it easy to discover and book the perfect venue for any occasion.',
            'Our journey is built on a foundation of trust, quality, and an unwavering commitment to excellence. We believe in empowering individuals and organizations to create memorable experiences through our carefully curated selection of venues, live shows, and entertainment options.',
            'As we continue to grow, our mission remains clear: to make venue booking and live show experiences accessible to all, ensuring every event is a success and every moment is unforgettable.'
          ]);
        }
      } catch (error) {
        console.error('Error loading about content:', error);
        // Use default content on error
        setParagraphs([
          'LeBRQ began as a vision to create a seamless platform for booking world-class venues, live shows, and entertainment experiences. We bridge the gap between event organizers and audiences, making it easy to discover and book the perfect venue for any occasion.',
          'Our journey is built on a foundation of trust, quality, and an unwavering commitment to excellence. We believe in empowering individuals and organizations to create memorable experiences through our carefully curated selection of venues, live shows, and entertainment options.',
          'As we continue to grow, our mission remains clear: to make venue booking and live show experiences accessible to all, ensuring every event is a success and every moment is unforgettable.'
        ]);
      } finally {
      setLoading(false);
      }
    };
    
    loadContent();
  }, []);

  // Calculate optimal image height based on device height for small screens
  const topBarHeight = 60; // Approximate height of top bar
  const safeAreaPadding = 20; // Safe area padding
  const readMoreButtonHeight = 40; // Approximate height of read more button
  const nameSectionHeight = 60; // Approximate height of name/title section
  const quotationImageHeight = 80; // Approximate height of quotation image
  const textPadding = 40; // Padding for text section
  
  const availableHeight = isSmallScreen ? height - topBarHeight - safeAreaPadding : height;
  
  // Calculate if read more is needed when heights are measured
  useEffect(() => {
    if (isSmallScreen && hasMeasuredFull && fullTextHeight > 0 && imageSectionHeight > 0) {
      const totalContentHeight = fullTextHeight + imageSectionHeight;
      const shouldShowReadMore = totalContentHeight > availableHeight && paragraphs.length > 1;
      setNeedsReadMore(shouldShowReadMore);
    } else if (!isSmallScreen) {
      setNeedsReadMore(false);
    }
  }, [fullTextHeight, imageSectionHeight, availableHeight, isSmallScreen, paragraphs.length, hasMeasuredFull]);
  
  // Calculate maximum text height when collapsed (to fit everything on screen)
  // Reserve space for: image, read more button, name section, quotation image, padding
  const maxTextHeightWhenCollapsed = isSmallScreen && needsReadMore && !isExpanded && hasMeasuredFull
    ? availableHeight - imageSectionHeight - readMoreButtonHeight - nameSectionHeight - quotationImageHeight - textPadding
    : undefined;
  
  // Always show all paragraphs, but truncate at bottom when collapsed using maxHeight
  const shouldShowCollapsed = needsReadMore && !isExpanded && hasMeasuredFull;
  const displayedParagraphs = paragraphs; // Always show all paragraphs
  
  // Calculate image height - use remaining space after text, but with min/max constraints
  const imageHeight = isSmallScreen && shouldShowCollapsed
    ? Math.max(200, Math.min(availableHeight - collapsedTextHeight - readMoreButtonHeight - nameSectionHeight - 20, 400))
    : (isSmallScreen ? Math.max(200, Math.min(availableHeight * 0.35, 350)) : '100%');

  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/Founder-Background.png')}
        style={styles.pageBackgroundImage}
        contentFit="cover"
      />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Back Button */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {isSmallScreen ? (
          <View style={[
            styles.smallScreenContainer,
            shouldShowCollapsed && { height: availableHeight }
          ]}>
            <ScrollView 
              contentContainerStyle={[
                styles.smallScreenScrollContent,
                shouldShowCollapsed && { flexGrow: 0 }
              ]}
              showsVerticalScrollIndicator={false}
              style={[
                styles.scrollView,
                shouldShowCollapsed && { height: availableHeight }
              ]}
              scrollEnabled={isExpanded || !needsReadMore}
            >
          <View style={[
            styles.contentWrapper,
            !isSmallScreen && styles.contentWrapperLarge
          ]}>
            {/* Left Side - Text Content */}
            <View 
              style={[
                styles.textSection,
                isSmallScreen && styles.textSectionSmall
              ]}
              onLayout={(event) => {
                if (isSmallScreen && paragraphs.length > 0) {
                  const { height: measuredHeight } = event.nativeEvent.layout;
                  
                  // Measure full height with all paragraphs (always rendered)
                  if (!hasMeasuredFull) {
                    setFullTextHeight(measuredHeight);
                    setHasMeasuredFull(true);
                  }
                  
                  // Update height when expanded/collapsed state changes
                  if (hasMeasuredFull) {
                    if (isExpanded) {
                      setFullTextHeight(measuredHeight);
                    } else if (needsReadMore && maxTextHeightWhenCollapsed) {
                      // When collapsed, measure the actual rendered height (should be limited by maxHeight)
                      setCollapsedTextHeight(Math.min(measuredHeight, maxTextHeightWhenCollapsed));
                      if (!hasMeasuredCollapsed) {
                        setHasMeasuredCollapsed(true);
                      }
                    }
                  }
                }
              }}
            >
              {/* Large Quotation Mark Image */}
              <View style={isSmallScreen ? styles.quotationContainerSmall : styles.quotationContainer}>
                <Image
                  source={require('@/assets/images/quotes.png')}
                  style={isSmallScreen ? styles.quotationImageSmall : styles.quotationImage}
                  contentFit="contain"
                />
              </View>
              
              {/* Text Paragraphs - Dynamic Content */}
          {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#14B8A6" />
                </View>
              ) : (
                <View style={maxTextHeightWhenCollapsed ? { maxHeight: maxTextHeightWhenCollapsed, overflow: 'hidden' as const } : undefined}>
                  {displayedParagraphs.map((paragraph, index) => (
                    <ThemedText 
                      key={index} 
                      style={isSmallScreen ? styles.paragraphSmall : styles.paragraph}
                    >
                      {paragraph}
                    </ThemedText>
                  ))}
                </View>
              )}
              
              {/* Read More/Less Link - Only show if content exceeds screen */}
              {needsReadMore && (
                <TouchableOpacity 
                  onPress={() => setIsExpanded(!isExpanded)}
                  style={styles.readMoreButton}
                >
                  <ThemedText style={styles.readMoreText}>
                    {isExpanded ? 'Read Less' : 'Read More'}
                  </ThemedText>
                  <Ionicons 
                    name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                    size={16} 
                    color="#14B8A6" 
                  />
                </TouchableOpacity>
              )}
              
              {/* Name and Title */}
              <View style={isSmallScreen ? styles.nameSectionSmall : styles.nameSection}>
                <ThemedText style={isSmallScreen ? styles.nameSmall : styles.name}>{founderName}</ThemedText>
                <ThemedText style={isSmallScreen ? styles.titleSmall : styles.title}>{founderTitle}</ThemedText>
              </View>
            </View>

            {/* Right Side - Image Background */}
            {!isSmallScreen && (
              <View style={styles.imageSection}>
                <Image
                  source={require('@/assets/images/mustafa.jpeg')}
                  style={styles.founderImage}
                  contentFit="cover"
                />
            </View>
            )}
            
            {/* Image for Small Screens */}
            {isSmallScreen && (
              <View 
                style={styles.imageSectionSmall}
                onLayout={(event) => {
                  if (isSmallScreen) {
                    const { height: measuredHeight } = event.nativeEvent.layout;
                    setImageSectionHeight(measuredHeight);
                  }
                }}
              >
                <Image
                  source={require('@/assets/images/mustafa.jpeg')}
                  style={[
                    styles.image, 
                    { 
                      height: typeof imageHeight === 'number' ? imageHeight : 300
                    }
                  ]}
                  contentFit="cover"
                />
              </View>
          )}
        </View>
      </ScrollView>
          </View>
        ) : (
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            style={styles.scrollView}
          >
            <View style={[
              styles.contentWrapper,
              styles.contentWrapperLarge
            ]}>
              {/* Left Side - Text Content */}
              <View style={styles.textSection}>
                {/* Large Quotation Mark Image */}
                <View style={styles.quotationContainer}>
                  <Image
                    source={require('@/assets/images/quotes.png')}
                    style={styles.quotationImage}
                    contentFit="contain"
                  />
                </View>
                
                {/* Text Paragraphs */}
                {paragraphs.map((paragraph, index) => (
                  <ThemedText key={index} style={styles.paragraph}>
                    {paragraph}
                  </ThemedText>
                ))}
                
                {/* Name and Title */}
                <View style={styles.nameSection}>
                  <ThemedText style={styles.name}>Musthafa</ThemedText>
                  <ThemedText style={styles.title}>Founder, LeBRQ</ThemedText>
                </View>
              </View>

              {/* Right Side - Image Background */}
              <View style={styles.imageSection}>
                <Image
                  source={require('@/assets/images/mustafa.jpeg')}
                  style={styles.founderImage}
                  contentFit="cover"
                />
              </View>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  pageBackgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  safeArea: {
    flex: 1,
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  scrollView: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 8 : 0,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
    minHeight: '100%',
  },
  smallScreenContainer: {
    flex: 1,
  },
  smallScreenScrollContent: {
    paddingBottom: 20,
    paddingTop: 0,
    flexGrow: 1,
  },
  contentWrapper: {
    flexDirection: 'column',
    paddingHorizontal: 20,
    // paddingVertical: 40,
    width: '100%',
    position: 'relative',
  },
  contentWrapperLarge: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 0,
    paddingVertical: 0,
    flex: 1,
  },
  textSection: {
    flex: 1,
    paddingHorizontal: 60,
    paddingVertical: 60,
    justifyContent: 'center',
    zIndex: 2,
  },
  textSectionSmall: {
    marginBottom: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flex: 1,
  },
  quotationContainer: {
    marginBottom: 12,
  },
  quotationContainerSmall: {
    marginBottom: 8,
  },
  quotationImage: {
    width: 120,
    height: 120,
    ...(Platform.OS === 'web' && {
      filter: 'brightness(0) saturate(100%) invert(68%) sepia(67%) saturate(500%) hue-rotate(140deg) brightness(95%) contrast(90%)',
    }),
  },
  quotationImageSmall: {
    width: 80,
    height: 80,
    ...(Platform.OS === 'web' && {
      filter: 'brightness(0) saturate(100%) invert(68%) sepia(67%) saturate(500%) hue-rotate(140deg) brightness(95%) contrast(90%)',
    }),
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 28,
    color: '#FFFFFF',
    marginBottom: 16,
    fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : 'System',
  },
  paragraphSmall: {
    fontSize: 14,
    lineHeight: 22,
    color: '#FFFFFF',
    marginBottom: 12,
    fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : 'System',
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  readMoreText: {
    fontSize: 16,
    color: '#14B8A6',
    fontWeight: '600',
    marginRight: 4,
    fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : 'System',
  },
  nameSection: {
    marginTop: 32,
  },
  nameSectionSmall: {
    marginTop: 16,
  },
  name: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : 'System',
  },
  nameSmall: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : 'System',
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
    color: '#14B8A6', // Teal color
    fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : 'System',
  },
  titleSmall: {
    fontSize: 16,
    fontWeight: '500',
    color: '#14B8A6', // Teal color
    fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : 'System',
  },
  imageSection: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  founderImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  imageOverlay: {
    // Removed overlay - image displays without background color
  },
  imageSectionSmall: {
    width: '100%',
    marginTop: 0,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'transparent',
    flexShrink: 0,
  },
  image: {
    width: '100%',
    backgroundColor: 'transparent',
  },
});
