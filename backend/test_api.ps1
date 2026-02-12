$base = 'http://localhost:5000'

function Wait-ForServer {
    param($url, $timeout=30)
    $start = Get-Date
    while (((Get-Date) - $start).TotalSeconds -lt $timeout) {
        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            return $true
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    return $false
}

Write-Output "Waiting for server..."
if (-not (Wait-ForServer -url $base -timeout 40)) {
    Write-Error "Server did not start in time"
    exit 1
}

function PostJson($path, $body, $token=$null) {
    $uri = "$base$path"
    $headers = @{}
    if ($token) { $headers['Authorization'] = "Bearer $token" }
    try {
        return Invoke-RestMethod -Uri $uri -Method Post -Body ($body | ConvertTo-Json -Depth 5) -ContentType 'application/json' -Headers $headers -ErrorAction Stop
    } catch {
        return @{ error = $_.Exception.Response.StatusCode.Value__ ; body = $_.Exception.Message }
    }
}

function GetJson($path, $token=$null) {
    $uri = "$base$path"
    $headers = @{}
    if ($token) { $headers['Authorization'] = "Bearer $token" }
    try {
        return Invoke-RestMethod -Uri $uri -Method Get -Headers $headers -ErrorAction Stop
    } catch {
        return @{ error = $_.Exception.Response.StatusCode.Value__ ; body = $_.Exception.Message }
    }
}

Write-Output "Registering admin user..."
$admin = PostJson '/api/auth/register' @{ name='Temp Admin'; email='tempadmin@example.com'; password='Password123!'; role='Admin' }
Write-Output ($admin | ConvertTo-Json -Depth 5)

Write-Output "Registering normal user..."
$user = PostJson '/api/auth/register' @{ name='Temp User'; email='tempuser@example.com'; password='Password123!'; role='User' }
Write-Output ($user | ConvertTo-Json -Depth 5)

Write-Output "Logging in admin..."
$loginAdmin = PostJson '/api/auth/login' @{ email='tempadmin@example.com'; password='Password123!' }
Write-Output ($loginAdmin | ConvertTo-Json -Depth 5)
$adminToken = $loginAdmin.token

Write-Output "Logging in user..."
$loginUser = PostJson '/api/auth/login' @{ email='tempuser@example.com'; password='Password123!' }
Write-Output ($loginUser | ConvertTo-Json -Depth 5)
$userToken = $loginUser.token

if (-not $adminToken) { Write-Error "Admin login failed"; exit 1 }
if (-not $userToken) { Write-Error "User login failed"; exit 1 }

Write-Output "Creating asset as Admin..."
$asset = PostJson '/api/assets' @{ name='Test Laptop'; type='Laptop'; serialNumber='SN12345678'; status='available' } $adminToken
Write-Output ($asset | ConvertTo-Json -Depth 5)
$assetId = $asset._id

Write-Output "Getting assets..."
$assets = GetJson '/api/assets'
Write-Output ($assets | ConvertTo-Json -Depth 5)

Write-Output "Updating asset as Admin..."
$updated = Invoke-RestMethod -Uri "$base/api/assets/$assetId" -Method Put -Headers @{ Authorization = "Bearer $adminToken" } -Body (@{ name='Test Laptop Updated' } | ConvertTo-Json) -ContentType 'application/json'
Write-Output ($updated | ConvertTo-Json -Depth 5)

Write-Output "Deleting asset as Admin..."
$deleted = Invoke-RestMethod -Uri "$base/api/assets/$assetId" -Method Delete -Headers @{ Authorization = "Bearer $adminToken" } -ErrorAction Stop
Write-Output ($deleted | ConvertTo-Json -Depth 5)

Write-Output "Fetching audit logs as Admin..."
$logs = GetJson '/api/audit' $adminToken
Write-Output ($logs | ConvertTo-Json -Depth 5)

Write-Output "All tests completed."
