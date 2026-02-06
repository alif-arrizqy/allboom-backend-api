import prisma from '../src/config/database';
import bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';

// Enum constants (mapping from schema)
const UserRole = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
} as const;

const AssignmentStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
} as const;

const SubmissionStatus = {
  NOT_SUBMITTED: 'NOT_SUBMITTED',
  PENDING: 'PENDING',
  REVISION: 'REVISION',
  GRADED: 'GRADED',
} as const;

const NotificationType = {
  ASSIGNMENT_CREATED: 'ASSIGNMENT_CREATED',
  ASSIGNMENT_DEADLINE: 'ASSIGNMENT_DEADLINE',
  SUBMISSION_GRADED: 'SUBMISSION_GRADED',
  SUBMISSION_REVISION: 'SUBMISSION_REVISION',
  ACHIEVEMENT_UNLOCKED: 'ACHIEVEMENT_UNLOCKED',
  GENERAL: 'GENERAL',
} as const;

// Indonesian names pool for more realistic data
const indonesianFirstNames = [
  'Ahmad', 'Budi', 'Citra', 'Dewi', 'Eko', 'Fitri', 'Gunawan', 'Hani', 'Indra', 'Joko',
  'Kartika', 'Lina', 'Maya', 'Nur', 'Oki', 'Putri', 'Rina', 'Saka', 'Tono', 'Umi',
  'Wahyu', 'Yani', 'Zaki', 'Ayu', 'Bambang', 'Cinta', 'Dian', 'Eka', 'Fajar', 'Gita',
  'Hadi', 'Ika', 'Jaya', 'Kiki', 'Lia', 'Mira', 'Nina', 'Omar', 'Puji', 'Rudi',
  'Sinta', 'Tari', 'Udin', 'Vina', 'Wawan', 'Yoga', 'Zara', 'Ade', 'Bayu', 'Cici'
];

const indonesianLastNames = [
  'Santoso', 'Wijaya', 'Dewi', 'Prasetyo', 'Handayani', 'Kurniawan', 'Susanto', 'Putra',
  'Lestari', 'Saputra', 'Rahayu', 'Kusuma', 'Nugroho', 'Sari', 'Wibowo', 'Sari',
  'Purnama', 'Azizah', 'Maulana', 'Megawati', 'Permata', 'Adeline', 'Kartika', 'Nur'
];

async function main() {
  console.log('🌱 Starting database seed...');

  // Hash password
  const hashedPassword = await bcrypt.hash('123456', 10);

  console.log('📚 Creating classes...');
  const classNames = ['1A', '1B', '2A', '2B', '3A', '3B'];
  const classes = await Promise.all(
    classNames.map((name) =>
      prisma.class.upsert({
        where: { name },
        update: {},
        create: { name, description: `Kelas ${name}` },
      })
    )
  );

  console.log(`✅ Created ${classes.length} classes`);

  // Create Teachers (3 teachers)
  console.log('👨‍🏫 Creating teachers...');
  const teachers = await Promise.all([
    prisma.user.upsert({
      where: { nip: '98277819' },
      update: {},
      create: {
        nip: '98277819',
        nis: null,
        email: '98277819@allboom.sch.id',
        password: hashedPassword,
        name: 'Wanda Oke',
        role: UserRole.TEACHER,
        phone: '081234567801',
        address: faker.location.streetAddress(),
        birthdate: new Date('1985-01-15'),
        avatar: null,
        className: null,
        classId: null,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { nip: '11827198' },
      update: {},
      create: {
        nip: '11827198',
        nis: null,
        email: '11827198@allboom.sch.id',
        password: hashedPassword,
        name: 'Abdul Gofar',
        role: UserRole.TEACHER,
        phone: '081234567802',
        address: faker.location.streetAddress(),
        birthdate: new Date('1986-02-20'),
        avatar: null,
        className: null,
        classId: null,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { nip: '12891681' },
      update: {},
      create: {
        nip: '12891681',
        nis: null,
        email: '12891681@allboom.sch.id',
        password: hashedPassword,
        name: 'Rico Lubis',
        role: UserRole.TEACHER,
        phone: '081234567803',
        address: faker.location.streetAddress(),
        birthdate: new Date('1987-03-25'),
        avatar: null,
        className: null,
        classId: null,
        isActive: true,
      },
    }),
  ]);

  console.log(`✅ Created ${teachers.length} teachers`);

  // Create Teacher-Class relationships
  // guru1 -> 1A, 1B
  // guru2 -> 2A, 2B
  // guru3 -> 3A, 3B
  console.log('🔗 Creating teacher-class relationships...');
  const teacherClassRelations = [
    { teacherId: teachers[0].id, classId: classes[0].id }, // guru1 -> 1A
    { teacherId: teachers[0].id, classId: classes[1].id }, // guru1 -> 1B
    { teacherId: teachers[1].id, classId: classes[2].id }, // guru2 -> 2A
    { teacherId: teachers[1].id, classId: classes[3].id }, // guru2 -> 2B
    { teacherId: teachers[2].id, classId: classes[4].id }, // guru3 -> 3A
    { teacherId: teachers[2].id, classId: classes[5].id }, // guru3 -> 3B
  ];

  for (const relation of teacherClassRelations) {
    await prisma.teacherClass.upsert({
      where: {
        teacherId_classId: {
          teacherId: relation.teacherId,
          classId: relation.classId,
        },
      },
      update: {},
      create: relation,
    });
  }

  console.log(`✅ Created ${teacherClassRelations.length} teacher-class relationships`);

  // Create Students (25 per class = 150 total)
  console.log('👨‍🎓 Creating students...');
  const students: Array<{
    id: string;
    name: string;
    nis: string;
    classId: string;
  }> = [];
  let nisCounter = 2025001; // Starting NIS

  for (const classData of classes) {
    for (let i = 0; i < 25; i++) {
      // Generate Indonesian name
      const firstName = indonesianFirstNames[Math.floor(Math.random() * indonesianFirstNames.length)];
      const lastName = indonesianLastNames[Math.floor(Math.random() * indonesianLastNames.length)];
      const studentName = `${firstName} ${lastName}`;
      const nis = nisCounter.toString().padStart(10, '0'); // 10-digit NIS
      nisCounter++;

      const student = await prisma.user.upsert({
        where: { nis },
        update: {},
        create: {
          nip: null,
          nis,
          email: `${nis}@allboom.sch.id`, // Use NIS to ensure unique email
          password: hashedPassword,
          name: studentName,
          role: UserRole.STUDENT,
          phone: `08${faker.string.numeric(10)}`,
          address: faker.location.streetAddress(),
          birthdate: faker.date.birthdate({ min: 15, max: 18, mode: 'age' }),
          avatar: null,
          className: classData.name,
          classId: classData.id,
          isActive: true,
        },
      });

      students.push({
        id: student.id,
        name: student.name,
        nis: student.nis!,
        classId: classData.id,
      });
    }
  }

  console.log(`✅ Created ${students.length} students`);

  // MediaType
  console.log('📁 Creating media types...');
  const mediaTypeData = [
    {
      name: 'Canvas',
      description: 'Karya seni lukis',
      isActive: true,
    },
    {
      name: 'Akrilik',
      description: '',
      isActive: true,
    },
    {
      name: 'Watercolour',
      description: '',
      isActive: true,
    },
  ];

  const mediaTypes = await Promise.all(
    mediaTypeData.map(async (mediaType) => {
      return await prisma.mediaType.upsert({
        where: { name: mediaType.name },
        update: {},
        create: mediaType,
      });
    })
  );

  console.log(`✅ Created ${mediaTypes.length} media types`);

  // Create Achievements
  console.log('🏆 Creating achievements...');
  const achievementData = [
    {
      name: 'Pemula Seni',
      description: 'Menyelesaikan tugas pertama dengan baik',
      icon: '🎨',
      criteria: {
        type: 'total_graded_submissions',
        value: 1,
        operator: '>=',
      },
    },
    {
      name: 'Pelukis Berbakat',
      description: 'Menyelesaikan 5 tugas yang sudah dinilai',
      icon: '🖌️',
      criteria: {
        type: 'total_graded_submissions',
        value: 5,
        operator: '>=',
      },
    },
    {
      name: 'Seniman Handal',
      description: 'Menyelesaikan 10 tugas yang sudah dinilai',
      icon: '🎭',
      criteria: {
        type: 'total_graded_submissions',
        value: 10,
        operator: '>=',
      },
    },
    {
      name: 'Bintang Kelas',
      description: 'Mendapatkan nilai rata-rata minimal 85',
      icon: '⭐',
      criteria: {
        type: 'average_grade',
        value: 85,
        operator: '>=',
      },
    },
    {
      name: 'Juara Sekolah',
      description: 'Mendapatkan nilai tertinggi 95 atau lebih',
      icon: '🥇',
      criteria: {
        type: 'highest_grade',
        value: 95,
        operator: '>=',
      },
    },
    {
      name: 'Semua Kategori',
      description: 'Menyelesaikan tugas dari semua kategori',
      icon: '🎪',
      criteria: {
        type: 'category_completion',
        value: 3,
        operator: '>=',
      },
    },
    {
      name: 'Sempurna',
      description: 'Mendapatkan nilai A (90+) sebanyak 3 kali',
      icon: '💯',
      criteria: {
        type: 'grade_count',
        value: 3,
        operator: '>=',
      },
    },
  ];

  const achievements = await Promise.all(
    achievementData.map(async (achievement) => {
      return await prisma.achievement.upsert({
        where: { name: achievement.name },
        update: {},
        create: {
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          criteria: achievement.criteria,
        },
      });
    })
  );

  console.log(`✅ Created ${achievements.length} achievements`);

  // Create Assignments
  console.log('📝 Creating assignments...');
  const now = new Date();
  type AssignmentData = {
    title: string;
    description: string;
    mediaTypeId: string;
    deadline: Date;
    status: 'DRAFT' | 'ACTIVE' | 'COMPLETED';
    createdById: string;
    classIds: string[];
  };

  const assignmentData: AssignmentData[] = [
    {
      title: 'Lukisan Pemandangan Alam',
      description: 'Buatlah lukisan pemandangan alam menggunakan cat air. Pilih tema gunung, pantai, atau hutan.',
      mediaTypeId: mediaTypes[0].id, // Canvas
      deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      status: AssignmentStatus.ACTIVE,
      createdById: teachers[0].id, // guru1
      classIds: [classes[0].id, classes[1].id], // 1A, 1B
    },
    {
      title: 'Akrilik: Karakter Fantasi',
      description: 'Buatlah karakter fantasi menggunakan software digital art (Photoshop, Procreate, dll).',
      mediaTypeId: mediaTypes[1].id, // Akrilik
      deadline: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      status: AssignmentStatus.ACTIVE,
      createdById: teachers[1].id, // guru2
      classIds: [classes[2].id, classes[3].id], // 2A, 2B
    },
    {
      title: 'Karya Seni Rupa 3D',
      description: 'Buatlah karya seni rupa 3D menggunakan bahan bekas. Foto dan unggah hasil karyanya.',
      mediaTypeId: mediaTypes[2].id, // Seni Rupa
      deadline: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
      status: AssignmentStatus.ACTIVE,
      createdById: teachers[2].id, // guru3
      classIds: [classes[4].id, classes[5].id], // 3A, 3B
    },
    {
      title: 'Lukisan Abstrak Modern',
      description: 'Buatlah lukisan abstrak dengan tema modern menggunakan teknik bebas.',
      mediaTypeId: mediaTypes[0].id, // Lukisan
      deadline: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago (completed)
      status: AssignmentStatus.COMPLETED,
      createdById: teachers[0].id, // guru1
      classIds: [classes[1].id], // 1B
    },
    {
      title: 'Akrilik: Poster Event',
      description: 'Buatlah poster untuk event sekolah menggunakan digital art.',
      mediaTypeId: mediaTypes[1].id, // Akrilik
      deadline: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      status: AssignmentStatus.DRAFT,
      createdById: teachers[1].id, // guru2
      classIds: [classes[2].id], // 2A
    },
  ];

  const assignments: Array<{
    id: string;
    title: string;
    createdAt: Date;
    mediaTypeId: string;
    deadline: Date;
    status: 'DRAFT' | 'ACTIVE' | 'COMPLETED';
    createdById: string;
  }> = [];
  for (const assignmentInfo of assignmentData) {
    const assignment = await prisma.assignment.create({
      data: {
        title: assignmentInfo.title,
        description: assignmentInfo.description,
        mediaTypeId: assignmentInfo.mediaTypeId,
        deadline: assignmentInfo.deadline,
        status: assignmentInfo.status,
        createdById: assignmentInfo.createdById,
        classes: {
          create: assignmentInfo.classIds.map((classId) => ({
            classId,
          })),
        },
      },
    });
    assignments.push(assignment);
  }

  console.log(`✅ Created ${assignments.length} assignments`);

  // Create Submissions with various statuses
  console.log('📤 Creating submissions...');
  let submissionCount = 0;

  // For each assignment, create submissions for some students
  for (let i = 0; i < assignments.length; i++) {
    const assignment = assignments[i];
    const assignmentClasses = await prisma.assignmentClass.findMany({
      where: { assignmentId: assignment.id },
      include: { class: true },
    });

    // Get all students in classes assigned to this assignment
    const eligibleStudents: Array<{
      id: string;
      name: string;
      classId: string | null;
    }> = [];
    for (const ac of assignmentClasses) {
      const classStudents = students.filter((s) => s.classId === ac.classId);
      eligibleStudents.push(...classStudents);
    }

    // Create submissions for 60% of eligible students (to have variety)
    const studentsToSubmit = eligibleStudents.slice(0, Math.floor(eligibleStudents.length * 0.6));

    for (let j = 0; j < studentsToSubmit.length; j++) {
      const student = studentsToSubmit[j];
      let status: 'NOT_SUBMITTED' | 'PENDING' | 'REVISION' | 'GRADED';
      let grade: number | null = null;
      let submittedAt: Date | null = null;
      let gradedAt: Date | null = null;
      let feedback: string | null = null;

      // Distribute statuses: 30% GRADED, 20% PENDING, 10% REVISION, 40% NOT_SUBMITTED
      const statusRand = j % 10;
      if (statusRand < 3) {
        // 30% GRADED
        status = SubmissionStatus.GRADED;
        grade = 70 + Math.floor(Math.random() * 30); // Random grade 70-100
        submittedAt = new Date(
          assignment.createdAt.getTime() + Math.random() * (now.getTime() - assignment.createdAt.getTime())
        );
        gradedAt = new Date(submittedAt.getTime() + Math.random() * (now.getTime() - submittedAt.getTime()));
        feedback =
          grade >= 85
            ? 'Karya yang sangat bagus! Kreativitas dan teknik yang ditunjukkan sangat memuaskan.'
            : grade >= 75
            ? 'Karya bagus, ada beberapa aspek yang bisa ditingkatkan lagi.'
            : 'Perlu lebih banyak latihan dan perbaikan pada teknik dasar.';
      } else if (statusRand < 5) {
        // 20% PENDING
        status = SubmissionStatus.PENDING;
        submittedAt = new Date(
          assignment.createdAt.getTime() + Math.random() * (now.getTime() - assignment.createdAt.getTime())
        );
      } else if (statusRand < 6) {
        // 10% REVISION
        status = SubmissionStatus.REVISION;
        submittedAt = new Date(
          assignment.createdAt.getTime() + Math.random() * (now.getTime() - assignment.createdAt.getTime())
        );
        feedback = 'Perlu revisi pada beberapa bagian. Silakan perbaiki dan kirim ulang.';
      } else {
        // 40% NOT_SUBMITTED
        status = SubmissionStatus.NOT_SUBMITTED;
      }

      if (status !== SubmissionStatus.NOT_SUBMITTED) {
        // Generate random image URLs from Picsum Photos
        const randomSeed = Math.floor(Math.random() * 1000);
        const imageUrl = `https://picsum.photos/800/600?random=${randomSeed}`;
        const imageThumbnail = `https://picsum.photos/300/300?random=${randomSeed}`;
        const imageMedium = `https://picsum.photos/800/600?random=${randomSeed}`;

        const submission = await prisma.submission.create({
          data: {
            assignmentId: assignment.id,
            studentId: student.id,
            title: `${assignment.title} - ${student.name}`,
            description: 'Ini adalah submission untuk tugas ini.',
            imageUrl,
            imageThumbnail,
            imageMedium,
            status,
            grade,
            feedback,
            submittedAt,
            gradedAt,
            revisionCount: status === SubmissionStatus.REVISION ? 1 : 0,
          },
        });

        // Create initial version in SubmissionRevision (version 1)
        await prisma.submissionRevision.create({
          data: {
            submissionId: submission.id,
            imageUrl: imageUrl,
            version: 1,
            submittedAt: submittedAt || submission.createdAt,
          },
        });

        // If status is REVISION, create a revision record with the revision note
        if (status === SubmissionStatus.REVISION && feedback) {
          await prisma.submissionRevision.create({
            data: {
              submissionId: submission.id,
              revisionNote: feedback,
              imageUrl: imageUrl,
              version: 2,
              submittedAt: new Date(submittedAt!.getTime() + 1000),
            },
          });
        }

        submissionCount++;
      }
    }
  }

  console.log(`✅ Created ${submissionCount} submissions`);

  // Create UserAchievements (for students who meet criteria)
  console.log('🎖️ Creating user achievements...');
  let userAchievementCount = 0;

  const studentsWithSubmissions = await prisma.user.findMany({
    where: {
      role: UserRole.STUDENT,
      submissions: {
        some: {
          status: SubmissionStatus.GRADED,
        },
      },
    },
    take: 20,
  });

  const pemulaAchievement = achievements.find((a: any) => a.name === 'Pemula Seni');
  if (pemulaAchievement) {
    const userAchievementData = studentsWithSubmissions.map((student: any) => ({
      userId: student.id,
      achievementId: pemulaAchievement.id,
    }));

    try {
      const result = await prisma.userAchievement.createMany({
        data: userAchievementData,
        skipDuplicates: true,
      });
      userAchievementCount = result.count;
    } catch (error) {
      console.error('Error creating user achievements:', error);
    }
  }

  console.log(`✅ Created ${userAchievementCount} user achievements`);

  // Create Notifications
  console.log('🔔 Creating notifications...');
  let notificationCount = 0;

  for (const assignment of assignments.slice(0, 2)) {
    const assignmentClasses = await prisma.assignmentClass.findMany({
      where: { assignmentId: assignment.id },
    });
    const classIds = assignmentClasses.map((ac: any) => ac.classId);
    const eligibleStudents = students.filter((s) => classIds.includes(s.classId));

    for (const student of eligibleStudents.slice(0, 5)) {
      await prisma.notification.create({
        data: {
          userId: student.id,
          type: NotificationType.ASSIGNMENT_CREATED,
          title: 'Tugas Baru!',
          message: `Tugas baru: "${assignment.title}" telah dibuat. Jangan lupa dikerjakan sebelum ${assignment.deadline.toLocaleDateString('id-ID')}`,
          link: `/assignments/${assignment.id}`,
          isRead: false,
        },
      });
      notificationCount++;
    }
  }

  const gradedSubmissions = await prisma.submission.findMany({
    where: {
      status: SubmissionStatus.GRADED,
    },
    include: {
      assignment: true,
    },
    take: 10,
  });

  for (const submission of gradedSubmissions) {
    await prisma.notification.create({
      data: {
        userId: submission.studentId,
        type: NotificationType.SUBMISSION_GRADED,
        title: 'Submission Dinilai!',
        message: `Submission Anda untuk "${submission.assignment.title}" telah dinilai. Nilai: ${submission.grade}`,
        link: `/submissions/${submission.id}`,
        isRead: Math.random() > 0.5,
      },
    });
    notificationCount++;
  }

  console.log(`✅ Created ${notificationCount} notifications`);

  // Seed Summary
  console.log('\n📊 Seed Summary:');
  console.log(`   - Classes: ${classes.length}`);
  console.log(`   - Teachers: ${teachers.length}`);
  console.log(`   - Teacher-Class Relationships: ${teacherClassRelations.length}`);
  console.log(`   - Students: ${students.length}`);
  console.log(`   - Media Types: ${mediaTypes.length}`);
  console.log(`   - Achievements: ${achievements.length}`);
  console.log(`   - Assignments: ${assignments.length}`);
  console.log(`   - Submissions: ${submissionCount}`);
  console.log(`   - User Achievements: ${userAchievementCount}`);
  console.log(`   - Notifications: ${notificationCount}`);
  console.log('\n✅ Database seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
