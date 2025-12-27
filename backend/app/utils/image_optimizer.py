"""
Image optimization utility for uploaded images.
Resizes, compresses, and converts images to WebP format for faster loading.
"""
from __future__ import annotations

import io
import os
import logging
from pathlib import Path
from typing import Optional, Tuple, BinaryIO

try:
    from PIL import Image
    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False
    logging.warning("Pillow not installed. Image optimization disabled.")


# Configuration for different image types
IMAGE_CONFIGS = {
    "banner": {
        "max_width": 1200,
        "max_height": 800,
        "quality": 75,
        "format": "WEBP",
    },
    "thumbnail": {
        "max_width": 400,
        "max_height": 400,
        "quality": 70,
        "format": "WEBP",
    },
    "gallery": {
        "max_width": 1600,
        "max_height": 1200,
        "quality": 80,
        "format": "WEBP",
    },
    "feature": {
        "max_width": 300,
        "max_height": 300,
        "quality": 65,
        "format": "WEBP",
    },
    "default": {
        "max_width": 1200,
        "max_height": 1200,
        "quality": 75,
        "format": "WEBP",
    },
}


def optimize_image(
    input_path: str | Path,
    output_path: Optional[str | Path] = None,
    image_type: str = "default",
    keep_original: bool = False,
) -> Tuple[str, int, int]:
    """
    Optimize an image file by resizing and compressing.
    
    Args:
        input_path: Path to the input image
        output_path: Path for the output image (optional, will use input with .webp extension if not provided)
        image_type: Type of image for config selection ("banner", "thumbnail", "gallery", "feature", "default")
        keep_original: If True, don't delete the original file
        
    Returns:
        Tuple of (output_path, original_size, optimized_size)
    """
    if not PILLOW_AVAILABLE:
        logging.warning("Pillow not available, returning original image")
        return str(input_path), 0, 0
    
    input_path = Path(input_path)
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")
    
    config = IMAGE_CONFIGS.get(image_type, IMAGE_CONFIGS["default"])
    original_size = input_path.stat().st_size
    
    try:
        with Image.open(input_path) as img:
            # Convert RGBA to RGB if needed (for WebP transparency issues on some viewers)
            if img.mode == "RGBA":
                # Create white background
                background = Image.new("RGB", img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3])  # Use alpha channel as mask
                img = background
            elif img.mode != "RGB":
                img = img.convert("RGB")
            
            # Calculate new dimensions maintaining aspect ratio
            width, height = img.size
            max_width = config["max_width"]
            max_height = config["max_height"]
            
            # Only resize if image is larger than max dimensions
            if width > max_width or height > max_height:
                ratio = min(max_width / width, max_height / height)
                new_width = int(width * ratio)
                new_height = int(height * ratio)
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # Determine output path
            if output_path is None:
                # Replace extension with .webp
                output_path = input_path.with_suffix(".webp")
            else:
                output_path = Path(output_path)
            
            # Save optimized image
            save_kwargs = {
                "quality": config["quality"],
                "optimize": True,
            }
            
            if config["format"] == "WEBP":
                save_kwargs["format"] = "WEBP"
                save_kwargs["method"] = 4  # Balance of speed and compression
            elif config["format"] == "JPEG":
                save_kwargs["format"] = "JPEG"
                save_kwargs["progressive"] = True
            
            img.save(output_path, **save_kwargs)
            
            optimized_size = output_path.stat().st_size
            
            # Delete original if different path and not keeping
            if not keep_original and input_path != output_path and input_path.exists():
                input_path.unlink()
            
            logging.info(
                f"Image optimized: {input_path.name} -> {output_path.name} "
                f"({original_size/1024:.1f}KB -> {optimized_size/1024:.1f}KB, "
                f"{(1 - optimized_size/original_size) * 100:.1f}% reduction)"
            )
            
            return str(output_path), original_size, optimized_size
            
    except Exception as e:
        logging.error(f"Failed to optimize image {input_path}: {e}")
        # Return original path if optimization fails
        return str(input_path), original_size, original_size


def optimize_image_buffer(
    file_buffer: BinaryIO,
    filename: str,
    image_type: str = "default",
) -> Tuple[bytes, str, int]:
    """
    Optimize an image from a file buffer without saving to disk first.
    
    Args:
        file_buffer: File-like object containing image data
        filename: Original filename (for extension detection)
        image_type: Type of image for config selection
        
    Returns:
        Tuple of (optimized_bytes, new_filename, original_size)
    """
    if not PILLOW_AVAILABLE:
        content = file_buffer.read()
        return content, filename, len(content)
    
    config = IMAGE_CONFIGS.get(image_type, IMAGE_CONFIGS["default"])
    
    # Read original content
    original_content = file_buffer.read()
    original_size = len(original_content)
    
    try:
        with Image.open(io.BytesIO(original_content)) as img:
            # Convert RGBA to RGB if needed
            if img.mode == "RGBA":
                background = Image.new("RGB", img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3])
                img = background
            elif img.mode != "RGB":
                img = img.convert("RGB")
            
            # Resize if needed
            width, height = img.size
            max_width = config["max_width"]
            max_height = config["max_height"]
            
            if width > max_width or height > max_height:
                ratio = min(max_width / width, max_height / height)
                new_width = int(width * ratio)
                new_height = int(height * ratio)
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # Save to buffer
            output_buffer = io.BytesIO()
            save_kwargs = {
                "quality": config["quality"],
                "optimize": True,
            }
            
            if config["format"] == "WEBP":
                save_kwargs["format"] = "WEBP"
                save_kwargs["method"] = 4
                new_ext = ".webp"
            else:
                save_kwargs["format"] = "JPEG"
                save_kwargs["progressive"] = True
                new_ext = ".jpg"
            
            img.save(output_buffer, **save_kwargs)
            
            optimized_content = output_buffer.getvalue()
            
            # Generate new filename with webp extension
            base_name = os.path.splitext(filename)[0]
            new_filename = f"{base_name}{new_ext}"
            
            logging.info(
                f"Image buffer optimized: {filename} -> {new_filename} "
                f"({original_size/1024:.1f}KB -> {len(optimized_content)/1024:.1f}KB)"
            )
            
            return optimized_content, new_filename, original_size
            
    except Exception as e:
        logging.error(f"Failed to optimize image buffer: {e}")
        # Return original content if optimization fails
        return original_content, filename, original_size


def create_thumbnail(
    input_path: str | Path,
    output_path: Optional[str | Path] = None,
    size: Tuple[int, int] = (200, 200),
    quality: int = 70,
) -> str:
    """
    Create a thumbnail version of an image.
    
    Args:
        input_path: Path to the input image
        output_path: Path for the thumbnail (optional)
        size: Maximum thumbnail dimensions (width, height)
        quality: JPEG/WebP quality (1-100)
        
    Returns:
        Path to the thumbnail
    """
    if not PILLOW_AVAILABLE:
        return str(input_path)
    
    input_path = Path(input_path)
    
    if output_path is None:
        output_path = input_path.with_stem(f"{input_path.stem}_thumb").with_suffix(".webp")
    else:
        output_path = Path(output_path)
    
    try:
        with Image.open(input_path) as img:
            if img.mode == "RGBA":
                background = Image.new("RGB", img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3])
                img = background
            elif img.mode != "RGB":
                img = img.convert("RGB")
            
            img.thumbnail(size, Image.Resampling.LANCZOS)
            img.save(output_path, format="WEBP", quality=quality, optimize=True)
            
            return str(output_path)
            
    except Exception as e:
        logging.error(f"Failed to create thumbnail: {e}")
        return str(input_path)
