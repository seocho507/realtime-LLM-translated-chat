package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/crypto/scrypt"
)

type PasswordService struct {
	saltBytes int
	n         int
	r         int
	p         int
	dkLen     int
}

func NewPasswordService() *PasswordService {
	return &PasswordService{
		saltBytes: 16,
		n:         1 << 14,
		r:         8,
		p:         1,
		dkLen:     64,
	}
}

func (p *PasswordService) HashPassword(password string) (string, error) {
	salt := p.randomBytes(p.saltBytes)
	digest, err := scrypt.Key([]byte(password), salt, p.n, p.r, p.p, p.dkLen)
	if err != nil {
		return "", err
	}
	return strings.Join([]string{
		"scrypt",
		strconv.Itoa(p.n),
		strconv.Itoa(p.r),
		strconv.Itoa(p.p),
		base64.URLEncoding.EncodeToString(salt),
		base64.URLEncoding.EncodeToString(digest),
	}, "$"), nil
}

func (p *PasswordService) VerifyPassword(password, encoded string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[0] != "scrypt" {
		return false
	}
	n, err1 := strconv.Atoi(parts[1])
	r, err2 := strconv.Atoi(parts[2])
	pp, err3 := strconv.Atoi(parts[3])
	salt, err4 := base64.URLEncoding.DecodeString(parts[4])
	expected, err5 := base64.URLEncoding.DecodeString(parts[5])
	if err1 != nil || err2 != nil || err3 != nil || err4 != nil || err5 != nil {
		return false
	}
	computed, err := scrypt.Key([]byte(password), salt, n, r, pp, len(expected))
	if err != nil {
		return false
	}
	return subtle.ConstantTimeCompare(computed, expected) == 1
}

func (p *PasswordService) randomBytes(n int) []byte {
	out := make([]byte, n)
	if _, err := rand.Read(out); err != nil {
		panic(err)
	}
	return out
}

func ValidateLocalCredentials(email, password string) error {
	if !strings.Contains(email, "@") || strings.TrimSpace(email) == "" {
		return fmt.Errorf("valid email is required")
	}
	if len(password) < 8 {
		return fmt.Errorf("password must be at least 8 characters")
	}
	return nil
}

func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func ResolveDisplayName(displayName, email string) string {
	if strings.TrimSpace(displayName) != "" {
		return strings.TrimSpace(displayName)
	}
	parts := strings.SplitN(email, "@", 2)
	return parts[0]
}
