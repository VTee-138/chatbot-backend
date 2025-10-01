# 🏢 **Groups System Documentation**

## **Tổng quan Hệ thống Groups**

Hệ thống Groups được thiết kế để mỗi user có thể tạo và tham gia nhiều organizations/teams khác nhau, mỗi group có data riêng biệt và được quản lý độc lập.

## **🔧 Database Schema**

### **1. Core Tables**

#### **users** - Bảng người dùng
```sql
- id (String, PK)
- email (String, unique)
- userName (String, unique)
- passwordHash (String)
- emailVerifiedAt (DateTime)
- role (Role: USER | ADMIN)
- twoFactorEnabled (Boolean)
```

#### **groups** - Bảng tổ chức/nhóm
```sql
- id (String, PK)
- name (String)                 -- Tên group
- slug (String, unique)         -- URL-friendly identifier
- logoUrl (String?)             -- Logo group
- creatorId (String, FK)        -- Owner của group
- receptionMode (ReceptionMode) -- MANUAL | AI
- creditBalance (Float)         -- Số credits hiện tại
- autoAssignEnabled (Boolean)   -- Tự động assign conversations
```

#### **group_members** - Bảng membership (Many-to-Many)
```sql
- id (String, PK)
- userId (String, FK)           -- User ID
- groupId (String, FK)          -- Group ID  
- role (GroupRole)              -- OWNER | ADMIN | MEMBER
- assignmentWeight (Int)        -- Trọng số cho auto-assign
- canBeAssigned (Boolean)       -- Có thể được assign conversation
- UNIQUE(userId, groupId)       -- Mỗi user chỉ có 1 role per group
```

### **2. Plan & Subscription System**

#### **plans** - Các gói dịch vụ
```sql
- id (String, PK)
- type (PlanType)               -- FREE | PLUS | ENTERPRISE
- name (String)                 -- "Free Plan", "Plus Plan"
- price (Float)                 -- Giá tháng
- maxGroups (Int)               -- Số groups tối đa
- maxMembersPerGroup (Int)      -- Số members tối đa per group
- maxChannelsPerGroup (Int)     -- Số channels tối đa per group
- monthlyCreditsGranted (Float) -- Credits được cấp mỗi tháng
```

#### **subscriptions** - Subscription của từng group
```sql
- id (String, PK)
- groupId (String, FK, unique)  -- Mỗi group có 1 subscription
- planId (String, FK)           -- Plan hiện tại
- status (SubscriptionStatus)   -- ACTIVE | CANCELED | PAST_DUE
- stripeCustomerId (String?)    -- Stripe customer
- stripeSubscriptionId (String?) -- Stripe subscription
```

### **3. Group Data Tables**

#### **channels** - Kênh kết nối của từng group
```sql
- id (String, PK)
- name (String)
- provider (ChannelProvider)    -- FACEBOOK | ZALO | INSTAGRAM
- providerChannelId (String)    -- ID từ provider
- groupId (String, FK)          -- Thuộc group nào
```

#### **customers** - Khách hàng của từng group
```sql
- id (String, PK)
- fullName (String)
- avatarUrl (String?)
- groupId (String, FK)          -- Thuộc group nào
```

#### **conversations** - Cuộc hội thoại của từng group
```sql
- id (String, PK)
- status (ConversationStatus)   -- OPEN | CLOSED | NEEDS_HUMAN_ATTENTION
- groupId (String, FK)          -- Thuộc group nào
- channelId (String, FK)        -- Từ channel nào
- customerId (String, FK)       -- Với customer nào
- assigneeId (String, FK?)      -- Assign cho member nào
```

## **🔄 User Journey & API Flow**

### **1. First-time User Flow**

#### **Bước 1: User đăng ký và đăng nhập**
```javascript
POST /api/v1/auth/register
POST /api/v1/auth/login

// Response sẽ có:
{
  "accessToken": "jwt_token",
  "needsOnboarding": true,     // User chưa có group
  "groupCount": 0
}
```

#### **Bước 2: Onboarding - Tạo group đầu tiên**
```javascript
POST /api/v1/groups/onboarding
{
  "name": "My First Company",
  "description": "Main workspace",
  "industry": "Technology"
}

// Tự động:
// 1. Tạo group mới
// 2. Set user làm OWNER
// 3. Gán FREE plan
// 4. Cấp monthly credits
// 5. Set làm active group
```

### **2. Multi-Group Management**

#### **Tạo thêm groups (theo plan limits)**
```javascript
POST /api/v1/groups
{
  "name": "Second Company",
  "receptionMode": "AI"
}

// Check plan limits trước khi tạo
// FREE plan: maxGroups = 1 (chỉ được 1 group)
// PLUS plan: maxGroups = 5
```

#### **Chuyển đổi giữa các groups**
```javascript
// Lấy danh sách groups
GET /api/v1/groups

// Chuyển active group
POST /api/v1/groups/{groupId}/switch

// Lấy group context hiện tại
GET /api/v1/groups/active
```

### **3. Group Context System**

#### **Active Group Concept**
- Mỗi user có thể thuộc nhiều groups
- Tại một thời điểm, user làm việc với 1 "active group"
- Active group được lưu trong cookie/session
- Tất cả operations (conversations, customers, channels) đều thuộc về active group

#### **Group Context Middleware**
```javascript
// Tự động inject group context vào request
app.use('/api/v1/conversations', injectGroupContext);

// Trong controller sẽ có:
req.groupContext = {
  groupId: "group_123",
  groupName: "My Company",  
  userRole: "OWNER",
  plan: { name: "Plus Plan", maxMembers: 10 }
}
```

## **🛡️ Permission System**

### **Group Roles**

#### **OWNER**
- Tạo và xóa group
- Thay đổi settings group
- Invite/remove members
- Upgrade/downgrade plans
- Transfer ownership

#### **ADMIN**  
- Invite/remove members (không remove OWNER)
- Manage conversations và customers
- Manage channels
- View analytics

#### **MEMBER**
- Handle conversations được assign
- View customers
- Create notes

### **Middleware Usage**
```javascript
// Require specific roles
app.use(requireGroupRole(['OWNER', 'ADMIN']));

// Check plan limits
app.use(checkPlanLimit('members', 'maxMembersPerGroup'));

// Log activities
app.use(logGroupActivity('member_invited'));
```

## **📊 Plan Limits System**

### **Default Plans**
```javascript
// FREE Plan
{
  maxGroups: 1,
  maxMembersPerGroup: 3,
  maxChannelsPerGroup: 2,
  monthlyCreditsGranted: 100
}

// PLUS Plan  
{
  maxGroups: 5,
  maxMembersPerGroup: 10,
  maxChannelsPerGroup: 10,
  monthlyCreditsGranted: 1000
}

// ENTERPRISE Plan
{
  maxGroups: 50,
  maxMembersPerGroup: 100,
  maxChannelsPerGroup: 50,  
  monthlyCreditsGranted: 10000
}
```

### **Limit Enforcement**
```javascript
// Khi invite member
const currentMembers = await getCurrentUsage(groupId, 'members');
if (currentMembers >= plan.maxMembersPerGroup) {
  return errorResponse('Member limit exceeded');
}

// Khi tạo channel
const currentChannels = await getCurrentUsage(groupId, 'channels');
if (currentChannels >= plan.maxChannelsPerGroup) {
  return errorResponse('Channel limit exceeded');
}
```

## **🔗 API Endpoints Summary**

### **Authentication với Group Context**
```javascript
POST /auth/login           // Include needsOnboarding, groupCount
POST /auth/refresh         // Maintain group context
```

### **Group Management**
```javascript
POST /groups/onboarding    // Tạo group đầu tiên
POST /groups              // Tạo group thêm
GET  /groups              // List user's groups
GET  /groups/active       // Get active group context
POST /groups/{id}/switch  // Switch active group
```

### **Group Operations (với group context)**
```javascript
GET  /groups/{id}/members       // List members
POST /groups/{id}/members       // Invite member
PUT  /groups/{id}/members/{id}  // Update role
DELETE /groups/{id}/members/{id} // Remove member

// Tất cả conversations, customers, channels APIs
// đều hoạt động trong context của active group
```

### **Plan & Subscription**
```javascript
GET  /groups/{id}/subscription  // Current subscription
POST /groups/{id}/upgrade      // Upgrade plan
POST /groups/{id}/downgrade    // Downgrade plan
GET  /groups/{id}/usage        // Current usage vs limits
```

## **🔄 Integration với Existing APIs**

### **Conversations API**
```javascript
// Tất cả conversations thuộc về active group
GET /conversations         // Chỉ conversations của active group
POST /conversations        // Tạo trong active group
PUT /conversations/{id}    // Chỉ edit nếu thuộc active group
```

### **Customers API** 
```javascript
// Customers isolated by group
GET /customers            // Chỉ customers của active group
POST /customers           // Tạo trong active group
```

### **Channels API**
```javascript
// Channels per group với plan limits
POST /channels           // Check maxChannelsPerGroup limit
GET /channels            // Chỉ channels của active group
```

## **🎯 Frontend Integration**

### **User State Management**
```javascript
// Redux/Zustand store
const userStore = {
  user: { id, email, userName },
  needsOnboarding: false,
  activeGroup: {
    id: "group_123",
    name: "My Company",
    role: "OWNER"
  },
  groups: [...], // All user's groups
  groupContext: {
    plan: { name: "Plus", limits: {...} },
    usage: { members: 5, channels: 3 }
  }
}
```

### **Group Switcher Component**
```jsx
<GroupSwitcher 
  groups={user.groups}
  activeGroup={user.activeGroup}
  onSwitch={(groupId) => switchGroup(groupId)}
/>
```

### **Plan Upgrade Prompts**
```jsx
{usage.members >= plan.maxMembers && (
  <UpgradePrompt 
    feature="members"
    currentPlan={plan.name}
    suggestedPlan="Plus"
  />
)}
```

## **🚀 Migration Strategy**

### **Existing Users**
1. Tạo default group cho users hiện tại
2. Migrate existing data vào groups
3. Set users làm OWNER của default groups
4. Assign FREE plans

### **Database Migration**
```sql
-- Tạo default group cho mỗi user
INSERT INTO groups (id, name, slug, creatorId, ...)
SELECT 
  gen_random_uuid(),
  COALESCE(u.userName, 'My Workspace'),
  COALESCE(u.userName, 'my-workspace'),
  u.id,
  ...
FROM users u;

-- Tạo memberships
INSERT INTO group_members (id, userId, groupId, role, ...)
SELECT ...;
```

## **📈 Monitoring & Analytics**

### **Group Analytics**
- Active users per group
- Conversations volume per group  
- Credit usage per group
- Plan utilization rates

### **Plan Analytics**
- Conversion rates: FREE → PLUS → ENTERPRISE
- Feature usage vs limits
- Churn analysis by plan type

---

Hệ thống này cho phép scaling linh hoạt từ individual users đến enterprise teams với clear separation of data và proper access control! 🏢