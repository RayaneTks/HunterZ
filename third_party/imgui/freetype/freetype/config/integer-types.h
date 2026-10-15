/*  FreeType integer-types — HunterZ build stub (Windows x64)
 *  NOTE: FT_Offset and FT_PtrDist are defined in fttypes.h, NOT here.
 */
#ifndef FREETYPE_CONFIG_INTEGER_TYPES_H_
#define FREETYPE_CONFIG_INTEGER_TYPES_H_

#include <freetype/config/public-macros.h>

FT_BEGIN_HEADER

  /* Basic integer types — Windows x64 MSVC */
  typedef signed   char         FT_Int8;
  typedef unsigned char         FT_UInt8;
  typedef signed   short        FT_Int16;
  typedef unsigned short        FT_UInt16;
  typedef signed   int          FT_Int32;
  typedef unsigned int          FT_UInt32;
  typedef signed   long long    FT_Int64;
  typedef unsigned long long    FT_UInt64;

  /* Fast variants */
  typedef signed   int          FT_Fast;
  typedef unsigned int          FT_UFast;

  /* FT_Offset and FT_PtrDist are defined in fttypes.h via size_t / ptrdiff_t */

FT_END_HEADER

#endif /* FREETYPE_CONFIG_INTEGER_TYPES_H_ */