import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from database import get_db
from models import UserDB, AuditLog
from schemas import UserBase
from utils import manager, update_readable_dump

router = APIRouter(prefix="/admin", tags=["admin"])

# Admin Routes
@router.get("/users", response_model=List[UserBase])
async def get_all_users(db: Session = Depends(get_db)):
    return db.query(UserDB).all()

@router.delete("/users/{user_id}")
async def delete_user(user_id: str, db: Session = Depends(get_db)):
    user_to_delete = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")
    
    log_entry = AuditLog(
        id=str(uuid.uuid4()),
        action="DELETE_USER",
        performed_by="ADMIN_SYSTEM",
        target_id=user_id,
        details=f"User {user_to_delete.email} deleted via dashboard."
    )
    db.add(log_entry)
    db.delete(user_to_delete)
    db.commit()
    
    # Send signal AFTER commit to ensure user is actually gone from DB
    await manager.send_logout_signal(user_id)
    
    update_readable_dump()
    return {"message": "User deleted"}

@router.patch("/users/{user_id}/role")
async def update_user_role(user_id: str, is_admin: bool, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_admin = is_admin
    db.commit()
    
    # Send signal AFTER commit so client sees updated data on sync
    await manager.send_sync_signal(user_id)
    
    update_readable_dump()
    return {"message": "Role updated"}

@router.get("/dashboard", response_class=HTMLResponse)
async def admin_dashboard(db: Session = Depends(get_db)):
    users = db.query(UserDB).all()
    
    user_rows = ""
    for user in users:
        user_rows += f"""
        <tr>
            <td>{user.email}</td>
            <td>{user.full_name or 'N/A'}</td>
            <td><code>{user.id}</code></td>
            <td>
                <select class="role-select" onchange="updateRole('{user.id}', this.value)">
                    <option value="false" {'selected' if not user.is_admin else ''}>User</option>
                    <option value="true" {'selected' if user.is_admin else ''}>Admin</option>
                </select>
            </td>
            <td>{user.created_at.strftime('%Y-%m-%d %H:%M')}</td>
            <td>
                <button class="delete-btn" onclick="deleteUser('{user.id}', '{user.email}')">Delete</button>
            </td>
        </tr>
        """

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>BowlRight | Admin Dashboard</title>
        <style>
            :root {{
                --bg: #0f172a;
                --card-bg: #1e293b;
                --text: #f8fafc;
                --primary: #3b82f6;
                --danger: #ef4444;
                --border: #334155;
            }}
            body {{
                font-family: 'Inter', system-ui, sans-serif;
                background-color: var(--bg);
                color: var(--text);
                margin: 0;
                padding: 40px;
                display: flex;
                flex-direction: column;
                align-items: center;
            }}
            .container {{
                width: 100%;
                max-width: 1000px;
            }}
            header {{
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 30px;
            }}
            h1 {{ margin: 0; font-weight: 700; color: var(--primary); }}
            .controls {{
                display: flex;
                gap: 15px;
                align-items: center;
                margin-bottom: 20px;
                background: var(--card-bg);
                padding: 15px;
                border-radius: 12px;
                border: 1px solid var(--border);
                width: 100%;
                box-sizing: border-box;
            }}
            .stats-card {{
                background: rgba(255,255,255,0.05);
                padding: 8px 16px;
                border-radius: 8px;
                font-weight: 500;
                font-size: 14px;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                background: var(--card-bg);
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 10px 25px rgba(0,0,0,0.3);
                border: 1px solid var(--border);
            }}
            th, td {{
                padding: 16px 20px;
                text-align: left;
                border-bottom: 1px solid var(--border);
            }}
            th {{
                background: rgba(255,255,255,0.05);
                font-weight: 600;
                text-transform: uppercase;
                font-size: 12px;
                letter-spacing: 0.05em;
                color: #94a3b8;
            }}
            tr:last-child td {{ border-bottom: none; }}
            tr:hover {{ background: rgba(255,255,255,0.02); }}
            .delete-btn {{
                background: var(--danger);
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.2s;
            }}
            .delete-btn:hover {{ opacity: 0.8; transform: translateY(-1px); }}
            .role-select {{
                background: rgba(255,255,255,0.05);
                color: var(--text);
                border: 1px solid var(--border);
                padding: 6px 12px;
                border-radius: 6px;
                cursor: pointer;
                outline: none;
            }}
            .role-select:focus {{ border-color: var(--primary); }}
            code {{ background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 4px; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <header>
                <h1>BowlRight Admin</h1>
                <div class="stats-card">Total Users: {len(users)}</div>
            </header>

            <div class="controls">
                <button onclick="location.reload()" style="background: var(--primary); border: none; color: white; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">Refresh Data</button>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Email</th>
                        <th>Name</th>
                        <th>User ID</th>
                        <th>Role</th>
                        <th>Joined</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {user_rows or '<tr><td colspan="6" style="text-align:center; padding: 40px; color: #64748b;">No users found</td></tr>'}
                </tbody>
            </table>
        </div>

        <script>
            async function deleteUser(userId, email) {{
                if (!confirm(`Are you sure you want to delete user: ${{email}}?`)) return;
                
                try {{
                    const response = await fetch(`/admin/users/${{userId}}`, {{
                        method: 'DELETE'
                    }});
                    
                    if (response.ok) {{
                        location.reload();
                    }} else {{
                        const err = await response.json();
                        alert('Error: ' + (err.detail || 'Failed to delete'));
                    }}
                }} catch (e) {{
                    alert('Network error or connection refused');
                }}
            }}

            async function updateRole(userId, isAdmin) {{
                try {{
                    const response = await fetch(`/admin/users/${{userId}}/role?is_admin=${{isAdmin}}`, {{
                        method: 'PATCH'
                    }});
                    
                    if (!response.ok) {{
                        const err = await response.json();
                        alert('Error updating role: ' + (err.detail || 'Failed'));
                        location.reload();
                    }}
                }} catch (e) {{
                    alert('Network error updating role');
                    location.reload();
                }}
            }}
        </script>
    </body>
    </html>
    """
    return html_content
