$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public class CredReaderStockSight {
    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern void CredFree(IntPtr credentialPtr);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct CREDENTIAL {
        public int Flags;
        public int Type;
        public IntPtr TargetName;
        public IntPtr Comment;
        public long LastWritten;
        public int CredentialBlobSize;
        public IntPtr CredentialBlob;
        public int Persist;
        public int AttributeCount;
        public IntPtr Attributes;
        public IntPtr TargetAlias;
        public IntPtr UserName;
    }

    public static string GetPassword(string target) {
        IntPtr credPtr;
        if (CredRead(target, 1, 0, out credPtr)) {
            CREDENTIAL cred = (CREDENTIAL)Marshal.PtrToStructure(credPtr, typeof(CREDENTIAL));
            byte[] bytes = new byte[cred.CredentialBlobSize];
            Marshal.Copy(cred.CredentialBlob, bytes, 0, cred.CredentialBlobSize);
            CredFree(credPtr);
            return Encoding.UTF8.GetString(bytes);
        }
        return null;
    }
}
'@

Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
$token = [CredReaderStockSight]::GetPassword("GitHub - https://api.github.com/nagpalansh27")
if (-not $token) {
    $token = [CredReaderStockSight]::GetPassword("LegacyGeneric:target=git:https://github.com")
}

if (-not $token) {
    Write-Error "GitHub token not found in Credential Manager"
    exit 1
}

Write-Output "GitHub token retrieved successfully! Checking repository..."

$headers = @{
    "Authorization" = "Bearer $token"
    "Accept" = "application/vnd.github.v3+json"
    "User-Agent" = "StockSight-Setup"
}

try {
    $repo = Invoke-RestMethod -Uri "https://api.github.com/repos/nagpalansh27/StockSight" -Headers $headers -Method Get
    Write-Output "Repo nagpalansh27/StockSight already exists!"
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Output "Repo doesn't exist yet. Creating private repo nagpalansh27/StockSight..."
        $body = @{
            name = "StockSight"
            description = "AI-powered fact-based stock quality analyzer & rumor buster"
            private = $true
            auto_init = $false
        } | ConvertTo-Json
        $newRepo = Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Headers $headers -Method Post -Body $body
        Write-Output "Repository created: $($newRepo.html_url)"
    } else {
        Write-Error "Error checking/creating repo: $_"
        exit 1
    }
}

# Now initialize git and push
Set-Location "C:\Users\anshn\Documents\GitHub\StockSight"
if (-not (Test-Path ".git")) {
    git init -b main
    git remote add origin "https://github.com/nagpalansh27/StockSight.git"
}

git add -A
git commit -m "feat: initial commit for StockSight - AI fact-based stock quality analyzer & rumor buster"

git remote set-url origin "https://nagpalansh27:$($token)@github.com/nagpalansh27/StockSight.git"
git push -u origin main --force
git remote set-url origin "https://github.com/nagpalansh27/StockSight.git"

Write-Output "Push complete and remote cleaned up! Repo is live on GitHub."
