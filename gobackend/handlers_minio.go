package main

import (
	"encoding/base64"
	"fmt"
	"io"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

var minioClient *minio.Client

func initMinioClient() error {
	client, err := minio.New(MinioEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(MinioAccessKey, MinioSecretKey, ""),
		Secure: true,
	})
	if err != nil {
		return fmt.Errorf("failed to create minio client: %w", err)
	}
	minioClient = client
	return nil
}

func handleUploadImage(c *fiber.Ctx) error {
	if minioClient == nil {
		if err := initMinioClient(); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "MinIO client not initialized: " + err.Error()})
		}
	}

	type UploadRequest struct {
		Image    string `json:"image"`
		Filename string `json:"filename"`
	}
	var req UploadRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Image == "" {
		return c.Status(400).JSON(fiber.Map{"error": "No image data provided"})
	}

	cleanFilename := req.Filename
	if cleanFilename == "" {
		cleanFilename = fmt.Sprintf("img_%d.png", time.Now().Unix())
	}
	reg := regexp.MustCompile(`[^a-zA-Z0-9_.\-]`)
	cleanFilename = reg.ReplaceAllString(cleanFilename, "_")

	if !hasExtension(cleanFilename) {
		cleanFilename = cleanFilename + ".png"
	}

	objectName := fmt.Sprintf("%d_%s", time.Now().Unix(), cleanFilename)

	mimeMatch := regexp.MustCompile(`^data:(image/\w+);base64,`)
	contentType := "image/png"
	if m := mimeMatch.FindStringSubmatch(req.Image); len(m) > 1 {
		contentType = m[1]
	}
	base64Data := mimeMatch.ReplaceAllString(req.Image, "")
	if base64Data == req.Image {
		idx := strings.Index(req.Image, ",")
		if idx > 0 {
			base64Data = req.Image[idx+1:]
		}
	}

	buffer, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid base64 image data"})
	}

	_, err = minioClient.PutObject(c.Context(), MinioBucket, objectName, strings.NewReader(string(buffer)), int64(len(buffer)), minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to upload to MinIO: " + err.Error()})
	}

	imageURL := fmt.Sprintf("%s/%s/%s", MinioBaseURL, MinioBucket, objectName)

	return c.JSON(fiber.Map{
		"success":     true,
		"image_url":   imageURL,
		"object_name": objectName,
		"bucket":      MinioBucket,
	})
}

func handleGetImage(c *fiber.Ctx) error {
	filename := c.Params("filename")
	if filename == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Filename required"})
	}
	if unescaped, err := url.QueryUnescape(filename); err == nil {
		filename = unescaped
	}

	if minioClient == nil {
		if err := initMinioClient(); err != nil {
			fmt.Println("[MinIO] init err:", err)
			return c.Status(500).JSON(fiber.Map{"error": "MinIO client not initialized: " + err.Error()})
		}
	}

	// Normalize filename
	filename = strings.TrimPrefix(filename, "/api/images/")
	filename = strings.TrimPrefix(filename, "api/images/")
	cleanBase := filename
	if idx := strings.LastIndex(cleanBase, "."); idx > 0 {
		cleanBase = cleanBase[:idx]
	}

	// Try candidate object keys in MinIO (handling missing extensions, uppercase/lowercase, hyphens vs underscores)
	candidates := []string{
		filename,
		cleanBase + ".png",
		cleanBase + ".jpg",
		cleanBase + ".jpeg",
		cleanBase + ".svg",
		cleanBase + ".webp",
		strings.ToLower(filename),
		strings.ToUpper(filename),
		strings.ReplaceAll(filename, "_", " "),
		strings.ReplaceAll(filename, " ", "_"),
		strings.ReplaceAll(filename, "-", "_"),
		strings.ReplaceAll(filename, "_", "-"),
		strings.ReplaceAll(cleanBase, "_", " ") + ".png",
		strings.ReplaceAll(cleanBase, " ", "_") + ".png",
		strings.ReplaceAll(cleanBase, "_", " ") + ".jpg",
		strings.ReplaceAll(cleanBase, " ", "_") + ".jpg",
		strings.ReplaceAll(cleanBase, "-", "_") + ".png",
		strings.ReplaceAll(cleanBase, "-", "_") + ".jpg",
	}

	var matchedStat minio.ObjectInfo
	var matchedKey string

	for _, cand := range candidates {
		stat, err := minioClient.StatObject(c.Context(), MinioBucket, cand, minio.StatObjectOptions{})
		if err == nil && stat.Size > 0 {
			matchedStat = stat
			matchedKey = cand
			fmt.Printf("[MinIO] Found exact match for '%s' -> '%s' (%d bytes)\n", filename, matchedKey, stat.Size)
			break
		}
	}

	// Dynamic prefix fallback search: list objects in MinIO bucket if exact match fails
	if matchedKey == "" {
		objectCh := minioClient.ListObjects(c.Context(), MinioBucket, minio.ListObjectsOptions{Recursive: true})
		for obj := range objectCh {
			if obj.Err != nil {
				continue
			}
			objLower := strings.ToLower(obj.Key)
			fnLower := strings.ToLower(cleanBase)
			if strings.Contains(objLower, fnLower) && obj.Size > 0 {
				matchedKey = obj.Key
				matchedStat = obj
				fmt.Printf("[MinIO] Found fuzzy list match for '%s' -> '%s' (%d bytes)\n", filename, matchedKey, obj.Size)
				break
			}
		}
	}

	if matchedKey == "" {
		fmt.Printf("[MinIO] Image NOT FOUND for '%s' -> Returning SVG fallback asset\n", filename)
		fallbackSVG := fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250" fill="none">
			<rect width="400" height="250" rx="12" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="2"/>
			<path d="M160 110L185 140L205 120L240 160H160V110Z" fill="#CBD5E1"/>
			<circle cx="230" cy="100" r="14" fill="#CBD5E1"/>
			<text x="200" y="190" font-family="system-ui, sans-serif" font-size="13" font-weight="600" fill="#64748B" text-anchor="middle">Figure Diagram: %s</text>
		</svg>`, filename)
		c.Set("Content-Type", "image/svg+xml")
		c.Set("Cache-Control", "public, max-age=3600")
		return c.Send([]byte(fallbackSVG))
	}

	matchedObj, err := minioClient.GetObject(c.Context(), MinioBucket, matchedKey, minio.GetObjectOptions{})
	if err != nil {
		fmt.Printf("[MinIO] GetObject error for '%s': %v -> Returning SVG fallback asset\n", matchedKey, err)
		fallbackSVG := fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250" fill="none">
			<rect width="400" height="250" rx="12" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="2"/>
			<path d="M160 110L185 140L205 120L240 160H160V110Z" fill="#CBD5E1"/>
			<circle cx="230" cy="100" r="14" fill="#CBD5E1"/>
			<text x="200" y="190" font-family="system-ui, sans-serif" font-size="13" font-weight="600" fill="#64748B" text-anchor="middle">Figure Diagram: %s</text>
		</svg>`, filename)
		c.Set("Content-Type", "image/svg+xml")
		return c.Send([]byte(fallbackSVG))
	}
	defer matchedObj.Close()

	buf, err := io.ReadAll(matchedObj)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to read image buffer"})
	}

	contentType := matchedStat.ContentType
	if contentType == "" || contentType == "binary/octet-stream" {
		if strings.HasSuffix(matchedKey, ".png") {
			contentType = "image/png"
		} else if strings.HasSuffix(matchedKey, ".jpg") || strings.HasSuffix(matchedKey, ".jpeg") {
			contentType = "image/jpeg"
		} else if strings.HasSuffix(matchedKey, ".svg") {
			contentType = "image/svg+xml"
		} else if strings.HasSuffix(matchedKey, ".webp") {
			contentType = "image/webp"
		} else {
			contentType = "image/jpeg"
		}
	}

	c.Set("Content-Type", contentType)
	c.Set("Cache-Control", "public, max-age=86400")
	return c.Send(buf)
}

