/*  FreeType public-macros — HunterZ build stub (Windows x64)  */
#ifndef FREETYPE_CONFIG_PUBLIC_MACROS_H_
#define FREETYPE_CONFIG_PUBLIC_MACROS_H_

/* FT_BEGIN_HEADER / FT_END_HEADER */
#ifdef __cplusplus
#  define FT_BEGIN_HEADER  extern "C" {
#  define FT_END_HEADER    }
#else
#  define FT_BEGIN_HEADER
#  define FT_END_HEADER
#endif

/* Export / local visibility */
#ifndef FT_EXPORT
#  define FT_EXPORT( x )      x
#endif
#ifndef FT_EXPORT_DEF
#  define FT_EXPORT_DEF( x )  x
#endif
#ifndef FT_LOCAL
#  define FT_LOCAL( x )       x
#endif
#ifndef FT_LOCAL_DEF
#  define FT_LOCAL_DEF( x )   x
#endif
#ifndef FT_BASE
#  define FT_BASE( x )        x
#endif
#ifndef FT_BASE_DEF
#  define FT_BASE_DEF( x )    x
#endif
#ifndef FT_CALLBACK_DEF
#  define FT_CALLBACK_DEF( x ) x
#endif

/*
 * FT_STATIC_BYTE_CAST — used in fttypes.h to build FT_MAKE_TAG
 * Casts any value to unsigned char then to `type`.
 */
#define FT_STATIC_BYTE_CAST( type, var )  (type)(unsigned char)(var)

/*
 * FT_STATIC_CAST — general static cast (used in imgui_freetype.cpp)
 */
#define FT_STATIC_CAST( type, var )  (type)(var)

/*
 * FT_UNUSED — suppress unused-parameter warning
 */
#define FT_UNUSED( arg )  ( (arg) = (arg) )

/*
 * FT_THROW — wrap error value (no-op in default config)
 */
#define FT_THROW( e )  FT_ERR( e )

#endif /* FREETYPE_CONFIG_PUBLIC_MACROS_H_ */